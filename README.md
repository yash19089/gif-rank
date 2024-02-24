# Prerequisites
- https://giphy.com/explore/kfc and https://giphy.com/search/kfc both use the endpoint: https://api.giphy.com/v1/gifs/search
- It takes an API key as a query param which is different for mobile devices (app) and desktop. And results different based on API key as in mobile and desktop results differ.
- You can intercept the HTTP traffic using HTTP Toolkit, it is fairly easy. You might run into the issue of [Certificate Pinning](https://httptoolkit.com/blog/frida-certificate-pinning/) with some apps such as Instagram and Whatsapp (they use Giphy). But you can just download Giphy apk on your mobile or use a virtual device inside Android studio to intercept the calls.
- Anyway, if you are this far, it means you can take a look at API calls made on mobile. 
- Every gif has an ID and a slug, you can extract ID from slug:
 - URL: `https://giphy.com/gifs/chicken-kfc-beginning-9JIw27scikqBy`
 - Slug: `chicken-kfc-beginning-9JIw27scikqBy`
 - ID: `9JIw27scikqBy`
- If you paginate using the search endpoint you would find that you can only get max 5000 gifs, it just returns an empty list after you cross that threshold no matter the page size or offset you use.
- The Search API uses a pingback ID as a query string, you can generate that with:

```
const getPingBackId = () => {
    const idLength = 16;
    const hexTime = new Date().getTime().toString(16)
    return`${hexTime}${uuid.v4().replace(/-/g, '')}`.substring(0, idLength) 
    // 16 character max
}
```
- After the search API, there's a analytics's API that consumes a user ID that you can randomely generate with, consider it more like a guest ID. We wouldn't want to generate multiple random user ids from a single IP.
```
const getGiphyRandomUserId = async () => {
    const config = {
        proxy: proxySettings, //Do not hit this endpoint with the same IP multiple times, you will get blacklisted.
        url: `https://api.giphy.com/v1/randomid?api_key=${frontendMobileApiKey}`,
        method: 'get',
        headers: {},
        timeout: 1000*60
    };
    try{
        const response = await axios(config);
        const body = await response;
        return body.data.data.random_id;
    } catch (e){
        return "82a1493b644e9d91686c34694527fe74" //fallback id if call fails due to rate limits
    }
}
```
	
# Idea:
- You want to rank the GIF with the ID: `9JIw27scikqBy` for the `kfc` hashtag/keyword.
- You will paginate using the search API ultil it's found
  ```
      const url = `https://api.giphy.com/v1/gifs/search?rating=pg-13&offset=${offset}&limit=${limit}&type=gifs&sort=relevant&q=${query}&api_key=${frontendMobileApiKey}&pingback_id=${pingbackId}`;
  ```
- If it's not found tough luck. But if it's found we can continue next steps.
- The search results give you can array of GIFs (can be other resources too if you want, not that we care), anyway. Take a look here: [https://api.giphy.com/v1/gifs/search?rating=pg-13&offset=25&limit=15&type=gifs&q=kfc&api_key=Gc7131jiJuvI7IdN0HZ1D7nh0ow5BU6g&pingback_id=18ddc04e47df0292](https://api.giphy.com/v1/gifs/search?rating=pg-13&offset=25&limit=15&type=gifs&q=kfc&api_key=Gc7131jiJuvI7IdN0HZ1D7nh0ow5BU6g&pingback_id=18ddc04e47df0292)
- Focus on this part:
  ![image](https://github.com/FlicLabs/giphy-web/assets/11132005/355b113c-1b8d-4d25-95bd-01c232213483)

- You would notice that the value of `analytics_response_payload` is used in `analytics.onload`, `analytics.click` and `analytics.onsent`, just the `action_type` query string param is different:
```
"analytics_response_payload": "e=Z2lmX2lkPTJyaDY0S1hla09PbVEmZXZlbnRfdHlwZT1HSUZfU0VBUkNIJmNpZD1lY2YwNWU0N2lzOW9jY2V3NzJnOXoyaXA4ZWR3cnU0MGFjYnJvcmRqajgwdWMwenkmY3Q9Zw",
```
Now, `e=Z2lmX2lkPTJyaDY0S1hla09PbVEmZXZlbnRfdHlwZT1HSUZfU0VBUkNIJmNpZD1lY2YwNWU0N2lzOW9jY2V3NzJnOXoyaXA4ZWR3cnU0MGFjYnJvcmRqajgwdWMwenkmY3Q9Zw` is not some gibberish. If you use this snippet:
```
  const base64Decode = (str) => {
    const buff = Buffer.from(str, 'base64');
    return buff.toString('ascii');
 }
 const payload = "Z2lmX2lkPTJyaDY0S1hla09PbVEmZXZlbnRfdHlwZT1HSUZfU0VBUkNIJmNpZD1lY2YwNWU0N2lzOW9jY2V3NzJnOXoyaXA4ZWR3cnU0MGFjYnJvcmRqajgwdWMwenkmY3Q9Zw"; //remove the "e=" prefix
 const decodedPayload = base64Decode(payload);
 const params = new URLSearchParams(decodedPayload);
 console.log(params);
```
you would get:
```
URLSearchParams {
  'gif_id' => '2rh64KXekOOmQ',
  'event_type' => 'GIF_SEARCH',
  'cid' => 'ecf05e47is9occew72g9z2ip8edwru40acbrordjj80uc0zy',
  'ct' => 'g' }
```
- Anyway, we will circle back to this. For now forget what what the `analytics_response_payload` contains. We need to do 3 API calls to the URLs that we found: `analytics.onload.url`, `analytics.click.url` and `analytics.onsent.url` but we need to add two more query parameters: `ts` and `random_id` (that we generated earlier).
- So your API call looks like: `<analytics.onload.url | analytics.click.url | analytics.onsent.url>&ts=${new Date()}&random_id=${randomId}`,

#Optimiztions/Idea Variations/Mix and Match:
Anyway, but this is too slow, we need to optimize this. In worst case if you have 5000 GIFS and you paginate with the mobile default page size of 15 limit (you can try increasing it, it goes max to `164` after that it results in empty response but I have also noticed that your IP gets blocked after few tries, so better to stick to less than 50). 
So 5000 GIFS, you can see 50 GIFs on 1 page. You need to paginate 100 pages. Each API call takes on avg 550ms, so that's 55 seconds spent to find one GIF. 
- You can search for it in parallel with proxies to make it faster but here's a better solution. You store the offset you found the GIF at, subtract 50 from the offset (because  ou won't find the GIF at the same offset in each API call, it could be +-50 positions).
- Then you can just skip all the reundant pages and find the GIF, You will find it on the current page or next page. Time reduced from 55 seconds to 1.1 seconds. Get the analytics payload and do the 3 API calls. 
- This will also free up so you can search for multiple GIFs and cache their offsets in parallel.
- Anyway, moving ahead. To do the 3 API calls, you need a randomUserId (they may or may not work), but you can try:
  - sending locally generated random userId (just make sure to follow the pattern spit out by their random user id api)
  - precompute a list of 10K random userId by hitting their API so you don't have to do it during the 3 analytics API call.
- Now why do we need to paginate over 5000 GIFs to find our GIFs, can we not generate the analytics payload ourselves and save all the trouble? What does it contain anyway?
```
URLSearchParams {
  'gif_id' => '2rh64KXekOOmQ', //We already have it
  'event_type' => 'GIF_SEARCH', //This can be hardcoded
  'cid' => 'ecf05e47is9occew72g9z2ip8edwru40acbrordjj80uc0zy', //This is the problem. I don't know what this is. I have tried hardcoding this and it didn't work. 
  'ct' => 'g' //This can hardcoded, something like pg rating category stuff.
}
```
- You can create a empty react app, import their mobile SDK and automate it and stimuate user searching, scrolling and tapping.
- A basic theory from their POV is if a user has scrolled 5 pages to click on a GIF, that GIF must be good else why would the user go through so much trouble and skip all GIFs on the first page?
- They can also be using some pattern detection tool, I mean, say you do this 400 times for a GIF, you send the onload event, you send the click event and then you send the onsent event. That's a ratio of `400:400:400` which seems weird. A ratio of `400:50:40` sounds more relastic. `click` and `onsent` are closer because most of the people who click on a GIF have made up their mind about it and will most probably send it. Just a theory though. I don't have stats to prove it.
# Basic Diagram
![image](https://github.com/FlicLabs/giphy-web/assets/11132005/a011d90d-2b56-4780-a0c4-7fe89f369d66)




