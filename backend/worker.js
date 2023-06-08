const {runPreChecks} = require('./utils/precheck');
const axios = require("axios");
const {Task, Proxy, History} = require("./utils/sequelize");
const {sqs} = require("./utils/aws");
const shuffle = require('shuffle-array');
const {Op, Sequelize} = require("sequelize");
const proxies = [];
let isProcessingMessage = false;
let frontendMobileApiKey = "KS6TYwUbP40o6bHh4Je0QOMXRlBTx6Pa";

const requestBinTest = async (proxySettings) => {
    const config = {
        proxy: proxySettings,
        url: `https://eo9wv8c69rkmzjd.m.pipedream.net`,
        method: 'get',
        headers: {},
        timeout: 1000*5
    };
    return await axios(config);
}

const getGiphyRandomUserId = async (proxySettings) => {
    const config = {
        proxy: proxySettings,
        url: `https://api.giphy.com/v1/randomid?api_key=${frontendMobileApiKey}`,
        method: 'get',
        headers: {},
        timeout: 1000*5
    };
    try{
        const response = await axios(config);
        const body = await response;
        return body.data.data.random_id;
    } catch (e){
        return "82a1493b644e9d91686c34694527fe74"
    }
}

const paginateUntilFound = async (tagName, gifId, randomId, pingbackId, proxySettings) => {
    let offset = 0;
    let limit = 50;
    let pageRecordsCount = limit;
    let totalRecordsCount = 250;
    let rating = 'pg-13';
    const q = tagName.toLowerCase();
    const targetId = gifId;
    const apiKey = frontendMobileApiKey;

    let indexCount = 0;

    try {
        while(pageRecordsCount >= limit && offset <= totalRecordsCount){
            let url = `https://api.giphy.com/v1/gifs/search?q=${q}&offset=${offset}&api_key=${apiKey}&limit=${limit}&rating=${rating}&random_id=${randomId}&pingback_id=${pingbackId}`;
            const config = {
                proxy: proxySettings,
                url: url,
                method: 'get',
                headers: {},
                timeout: 1000*5
            };

            const response = await axios(config);
            const body = await response;

            const gifs = body.data.data;
            for(let i = 0; i < gifs.length; i++){
                if(gifs[i].id === targetId){
                    return {gif: gifs[i], position: indexCount};
                }
                indexCount++;
            }

            pageRecordsCount = body.data.pagination.count;
            totalRecordsCount = body.data.pagination.total_count;
            offset+=limit;
        }
    } catch (e){
        return {gif: null, position: -1};
    }

    return {gif: null, position: -1};
}

const isTaskPossible = async (tagName, gifId) => {
    const proxySettings = getProxySettingsByIndex(0);
    const randomId = await getGiphyRandomUserId(proxySettings);
    const pingbackId = `${randomId}${Math.random().toString(36).slice(-5)}`;
    const {gif,position} = await paginateUntilFound(tagName, gifId, randomId, pingbackId, proxySettings);
    return !(gif === null || position < 0);
}

const dispatchPingback = async (gif, position, randomId, pingbackId, proxySettings) => {
    const body = {
        "events": [
            {
                "action_type": "CLICK",
                "analytics_response_payload": gif.analytics_response_payload,
                "attributes": {
                    "layout_type": "GRID",
                    "position": position.toString()
                },
                "gif_id": gif.id,
                "logged_in_user_id": "",
                "random_id": randomId,
                "ts": Date.now(),
                "user_id": pingbackId
            },
            {
                "action_type": "SENT",
                "analytics_response_payload": gif.analytics_response_payload,
                "attributes": {
                    "layout_type": "GRID",
                    "position": position.toString()
                },
                "gif_id": gif.id,
                "logged_in_user_id": "",
                "random_id": randomId,
                "ts": Date.now(),
                "user_id": pingbackId
            }
        ]
    }
    // console.log(proxySettings);
    const config = {
        proxy: proxySettings,
        url: `https://pingback.giphy.com/v2/pingback?api_key=${frontendMobileApiKey}&pingback_id=${pingbackId}`,
        method: 'post',
        headers: {},
        data: body,
        timeout: 1000*5
    };

    // console.log(config);

    return await axios(config);
}

function getProxySettingsByIndex(proxyIndex) {
    proxyIndex = Math.floor(proxyIndex);
    proxyIndex = proxyIndex%proxies.length;

    return {
        protocol: 'http',
        host: proxies[proxyIndex].host,
        port: proxies[proxyIndex].port,
        auth: {
            username: proxies[proxyIndex].username,
            password: proxies[proxyIndex].password,
        }
    }
}

const doHitsAndReport = async (tagName, gifId, hitsLeft) => {
    const requests = [];
    let sumPositions = 0;
    let positions = [];
    let successCount = 0;
    for(let i = 0; i<hitsLeft; i++){
        requests.push((async () => {
            try {
                const proxySettings = getProxySettingsByIndex(i);
                const randomId = await getGiphyRandomUserId(proxySettings);
                const pingbackId = `${randomId}${Math.random().toString(36).slice(-5)}`;
                const {gif,position} = await paginateUntilFound(tagName, gifId, randomId, pingbackId, proxySettings);
                if(gif === null || position < 0){
                    throw new Error("empty gif");
                }
                positions.push(position);
                sumPositions+=position;
                return (await dispatchPingback(gif, position, randomId, pingbackId, proxySettings)).data.status;
            } catch (e) {
                return -1;
            }
        })())
    }


    const finishedRequests = await Promise.all(requests);

    for(const finishedRequest of finishedRequests){
        if(finishedRequest === 200){
            successCount++;
        }
    }

    if(successCount > 0){
        await History.create({
            tagName,
            gifId,
            position: sumPositions/successCount
        })
    }

   return successCount;
}

const processMessage = async (message) => {
    const task = JSON.parse(message.Body);
    const {tagName, currentCount, targetCount, gifId} = task;

    console.log(`Received TaskId ${task.id} - ${gifId} @ ${tagName}.`)

    // Update the task status in the database
    await Task.update(
        {
            isProcessing: true,
            inQueue: false,
        },
        {
            where: { id: task.id },
        }
    );

    console.log(`${gifId} @ ${tagName} marked in processing`)
    console.time("Determining feasibility.");
    const isPossible = await isTaskPossible(tagName, gifId);
    console.timeEnd("Determining feasibility.");

    if(!isPossible){
        console.log(`Not possible for ${gifId} @ ${tagName}`)
        await Task.update(
            {
                isProcessing: false,
                isPossible: false,
            },
            {
                where: { id: task.id },
            }
        );
        return false;
    } else {
        console.log(`${gifId} @ ${tagName} is possible.`)
    }

    const hitsLeft = Math.min(targetCount - currentCount, proxies.length, 200);
    console.log(`${gifId} @ ${tagName} starting hits: ${hitsLeft}.`);
    const hitsDone = await doHitsAndReport(tagName, gifId, hitsLeft);

    console.log(`${gifId} @ ${tagName} hit done ${hitsDone}`)

    await Task.update(
        {
            isProcessing: false,
            currentCount: Number(currentCount) + Number(hitsDone)
        },
        {
            where: { id: task.id },
        }
    );

    console.table(`${gifId} @ ${tagName} marked as not processing. Updated hit count.`);

    return true;
}

// Function to receive messages from the SQS queue
const receiveMessages = async () => {
    try {
        if (isProcessingMessage) {
            return; // Return early if a message is still being processed
        }

        const receiveMessageParams = {
            QueueUrl: process.env.SQS_QUEUE_URL,
            MaxNumberOfMessages: 1,
        };

        const response = await sqs.receiveMessage(receiveMessageParams).promise();

        const messages = response.Messages || [];

        if (messages.length > 0) {
            await checkProxyCount();
            await loadProxies();

            isProcessingMessage = true; // Set the processing flag to true

            await processMessage(messages[0]);

            isProcessingMessage = false; // Set the processing flag back to false
            await sqs.deleteMessage({ QueueUrl: process.env.SQS_QUEUE_URL, ReceiptHandle: messages[0].ReceiptHandle }).promise();
        }
    } catch (error) {
        console.error('Failed to receive messages from the SQS queue:', error);
    }
};


// Start the worker to continuously consume messages from the SQS queue
const startWorker = () => {
    setInterval(receiveMessages, 20000); // Runs every 30 seconds
};

const checkProxyCount = async () => {
    try {
        const proxyCount = await Proxy.count();
        if (proxyCount < 100) {
            console.log('Proxy count is less than 100. Terminating worker.');
            process.exit(0); // Terminate the worker process
        }
    } catch (error) {
        console.error('Failed to check proxy count:', error);
    }
};

const loadProxies = async () => {
    proxies.length = 0;
    const proxyData = await Proxy.findAll({
        where: {
            isInactive: {
                [Op.ne]: true,
            },
        },
        order: Sequelize.literal('RANDOM()'), // Order the results randomly
        limit: 250, // Limit the number of records to 250
    });
    for(const proxy of proxyData){
        proxies.push({
            host: proxy.ip,
            port: proxy.port,
            username: proxy.username,
            password: proxy.password,
        })
    }

    console.log(`Loaded ${proxies.length} proxies`);
}

// Initialize the worker
runPreChecks();
startWorker();

