const axios = require("axios");
let frontendMobileApiKey = "KS6TYwUbP40o6bHh4Je0QOMXRlBTx6Pa";


const getGiphyRandomUserId = async () => {
    const config = {
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

const paginateUntilFound = async (tagName, gifId, randomId, pingbackId) => {
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

const test = async () => {
    let randomId = await getGiphyRandomUserId();
    let x = await paginateUntilFound("hurray", "ZxKcrTNF9864epaDUs", randomId, "18863ba3bd6cfa48")
    console.log(x);
}

test()

