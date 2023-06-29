const crypto = require('crypto');
const {Task, Proxy, sequelize} = require("./sequelize");
const {sqs} = require("./aws");
const { Op, Sequelize} = require('sequelize');
const axios = require("axios");

// Generate batch ID using IP, time, and random number
const generateBatchId = (ip) => {
    const timestamp = Date.now();
    const random = Math.random();

    const batchIdString = `${ip}${timestamp}${random}`;

    // Convert batch ID string to MD5 hash
    return crypto.createHash('md5').update(batchIdString).digest('hex');
};


// Function to pick up tasks and send them to the AWS queue
const sendTasksToQueue = async () => {
    try {
        const tasks = await Task.findAll({
            where: {
                isPossible: true,
                inQueue: false,
                isProcessing: false,
                currentCount: { [Op.lt]: Sequelize.col('targetCount') },
            },
            limit: 10,
        });

        if (tasks.length > 0) {
            const queueUrl = process.env.SQS_QUEUE_URL;

            console.log(queueUrl);

            const entries = tasks.map((task) => {
                return {
                    Id: task.id.toString(),
                    MessageBody: JSON.stringify(task),
                };
            });

            if(entries.length === 0) {
                return;
            }

            const sendMessageParams = {
                Entries: entries,
                QueueUrl: queueUrl,
            };

            // Send the tasks to the AWS queue
            await sqs.sendMessageBatch(sendMessageParams).promise();

            // Update the tasks' isQueue flag to true
            await Task.update({ inQueue: true }, { where: { id: tasks.map((task) => task.id) } });
            console.log(`Pushed ${tasks.length} tasks to queue`);
        }
    } catch (error) {
        console.error('Failed to send tasks to the AWS queue:', error);
    }
};

let lastProxyId = -1;

const proxyHealthChecker = async () => {

    try {

        await sequelize.query(
            "UPDATE Proxies SET isInactive = 0 WHERE isInactive = 1 AND updatedAt < (NOW() - INTERVAL 10 MINUTE)",
            {
                type: sequelize.QueryTypes.UPDATE
            }
        )

        console.log(`Marking proxies to become active again.`);

    } catch (e) {
        console.log("Failed to mark proxies as active", e);
    }

    return;

    console.log(`Picking proxies above id: ${lastProxyId}`);
    const proxies = await Proxy.findAll({
        where: {
            isInactive: {
                [Op.ne]: true,
            },
            id: {
                [Op.gt]: lastProxyId,
            },
        },
        limit: 10, // Limit the number of records to 250
    });

    if(proxies.length === 0){
        console.log(`Resetting last proxy Id to -1`);
        lastProxyId = -1;
    }

    const url = `https://api.giphy.com/v1/gifs/search?q=test&key=KS6TYwUbP40o6bHh4Je0QOMXRlBTx6Pa&limit=1`;

    for(const proxy of proxies){
        lastProxyId = proxy.id;
        const config = {
            proxy: {
                protocol: 'http',
                host: proxy.ip,
                port: proxy.port,
                auth: {
                    username: proxy.username,
                    password: proxy.password,
                }
            },
            url: url,
            method: 'get'
        };

        try {
            await axios(config);
            console.log(`Proxy ${proxy.id} works fine`);
        } catch (e) {
            console.log(`Marking proxy ${proxy.id} as inactive`);
            proxy.isInactive = true;
            await proxy.save();
        }
    }
}

module.exports = {
    generateBatchId,
    sendTasksToQueue,
    proxyHealthChecker
};
