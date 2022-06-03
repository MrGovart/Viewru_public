const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs')
const uuid = require('uuid');
const port = process.env.PORT || 3000;
const fetch = require('node-fetch');
const _r34 = path.join(__dirname, 'r34');
const _reddit = path.join(__dirname, 'reddit');
const _state = path.join(_reddit, '.state.txt');
const _oauth = path.join(_reddit, '.oauth.txt');
const _secret = path.join(_reddit, '.secret.txt');


app.use('/reddit',
    function(req, res, next) {
        if (req.originalUrl == '/reddit/reddit_index.html') {
            var files = fs.readdirSync(_reddit, 'utf-8');
            if (!files.includes('.oauth.txt')) {
                res.redirect(auth());
                return;
            }
        }
        next();
    },
    express.static(_reddit));
app.get('/reddit', (req, res) => {
    var files = fs.readdirSync(_reddit, 'utf-8');
    console.log(files);
    if (!files.includes('.oauth.txt')) {
        res.redirect(auth());
    } else {
        res.redirect('reddit_index.html');
    }
});

app.get('/reddit_auth', (req, res) => {
    var json = JSON.parse(fs.readFileSync(_state, 'utf-8'));
    console.log(req.query)
    console.log(json.state)
    if (req.query.state == json.state) {
        fetch('https://www.reddit.com/api/v1/access_token', {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + base64encodedData,
            },
            method: 'POST',
            body: 'grant_type=authorization_code&code=' + req.query.code + '&redirect_uri=' + URI,
        })
        .then(response => response.json())
        .then(json => { console.log(json); fs.writeFileSync(_oauth, JSON.stringify(json)) })
        setTimeout(() => res.redirect('/reddit'), 1000);
    } else {
        res.end('State is not matched')
    }
});

app.use('/r34', express.static(_r34));
app.get('/r34/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'r34_index.html'));
});
app.get('/r34', (req, res) => {
    console.log('index.html redir')
    res.redirect('r34_index.html');
});

app.get('/', (req, res) => {
    res.redirect('/r34')
});

app.get('/reddit_token', (req, res) => {
    var json = JSON.parse(fs.readFileSync(_oauth, 'utf-8'));
    var token = json.access_token;
    res.send(token);
})
app.get('/reddit_token_refresh', (req, res) => {
    var json = JSON.parse(fs.readFileSync(_oauth, 'utf-8'));
    if (json.refresh_token == undefined) {
        res.redirect(auth())
    } else {
        tokenRefresh().then(token => {
            res.send(token)
        })
    }
});
app.get('/scrape', (req, res) => {
    var scrapeThis = req.query.url;
    scrape(scrapeThis).then(url => res.send(url));
})

app.listen(port, () => {
    console.log(`Server running at port ${port}`)
    console.log(__dirname)
  })

async function test() {
    fetch('https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&limit=1')
    .then(response => response.text())
    .then(json => console.log(json))
}


// Authorization
const SECRET = fs.readFileSync(_secret, 'utf-8');
const CLIENT_ID     = 'CLIENT_ID';
const TYPE          = 'code';
const URI           = 'http://127.0.0.1:3000/reddit_auth';
const DURATION      = 'permanent';
const SCOPE_STRING  = 'read';
const base64encodedData = Buffer.from(CLIENT_ID + ':' + SECRET).toString('base64');

function auth() {
    var json = JSON.parse(fs.readFileSync(_state, 'utf-8'));
    var RANDOM_STRING = uuid.v4();
    json.state = RANDOM_STRING;
    fs.writeFileSync(_state, JSON.stringify(json));
    var authURL = 'https://www.reddit.com/api/v1/authorize?client_id=' + CLIENT_ID
    + '&response_type=' + TYPE
    + '&state=' + RANDOM_STRING
    + '&redirect_uri=' + URI
    + '&duration=' + DURATION
    + '&scope=' + SCOPE_STRING;
    return authURL;
}

// Refresh TOKEN

async function tokenRefresh() {
    var token;
    var refresh_token = JSON.parse(fs.readFileSync(_oauth, 'utf-8')).refresh_token;
    await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + base64encodedData,
            },
            body:'grant_type=refresh_token&refresh_token=' + refresh_token,
        })
    .then(response => response.json())
    .then(json => { token = json.access_token;  fs.writeFileSync(_oauth, JSON.stringify(json)); });
    return token;
}

//  scrapping. some puppeteer stuff
const puppeteer = require('puppeteer');
const puppetUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36'

async function scrape(url) {
    const browser = await puppeteer.launch();
    console.log('launched')
    const page = await browser.newPage();
    console.log('new page opened')
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (req.resourceType() === 'image' || req.resourceType() === 'font' || req.resourceType() === 'media' || req.resourceType() === 'png') {
            req.abort();
            } else {
            req.continue();
            }
        });
    await page.setUserAgent(puppetUserAgent);
    const status = await page.goto(url);
    if (status == '404') {
        return '404';
    }
    console.log('page loaded')
  
    // Get the "viewport" of the page, as reported by the page.
    url = page.url();
    switch (true) {
        case (url.includes('redgifs.com')): {
            const videoURL = await page.waitForSelector('video[src^="https://thumbs2"]')
            .then(
            video => { return video.evaluate(video => video.src) },
            () => {console.log('The source is not found and probably deleted'); return 'failed'});
            await browser.close();
            console.log(url + ' : ' + videoURL)
            return videoURL;
        }
        case (url.includes('gfycat.com')): {
            const videoURL = await page.waitForSelector('source[src^="https://giant"]')
            .then(video => { return video.evaluate(video => video.src) },
            () => {console.log('The source is not found and probably deleted'); return 'failed'});
            await browser.close();
            console.log(url + ' : ' + videoURL)
            return videoURL;
        }
        case (url.includes('gifs.info') || url.includes('rednsfw.com')): {
            const videoURL = await page.waitForSelector('meta[itemprop="contentURL"]')
            .then(video => { return video.evaluate(video => video.content) },
            () => {console.log('The source is not found and probably deleted'); return 'failed'});
            await browser.close();
            console.log(url + ' : ' + videoURL)
            return videoURL;
        }
        default: {
            const src = await page.waitForSelector('iframe[allowfullscreen]')
            .then(video => { return video.evaluate(video => video.src) },
            () => {console.log('The source is not found and probably deleted'); return 'failed'});
            if (src.includes('xvideos.com')) { // HERE scrape HLS sctream instead somehow, it's possible
                console.log('xvideos')
                await page.goto(src)
                const videoURL = await page.waitForFunction('html5player.url_high').then(p => { return p.jsonValue() });
                await browser.close();
                console.log(url + ' : ' + videoURL)
                return videoURL;
            } else {
                await browser.close();
                console.log(url + ' : ' + src)
                return src;
            }
        }
    }

}