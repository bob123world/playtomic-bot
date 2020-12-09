const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const browserObject  = require('./browser');

let config_json = fs.readFileSync(path.join(__dirname, 'config.json'));
let config = JSON.parse(config_json);
console.log(config);

async function logIn(page, email, pwd){
    console.log(email);
    console.log(pwd);
    let url = 'https://playtomic.io/';
    console.log(`Navigating to ${url}...`);
    await page.goto(url);
    // Wait for the required DOM to be rendered
    await page.waitForSelector('#root > div > div.cookies.cookies--shown > div > div.cookies__accept > a > div');
    // Click the cookie pop-up
    try {
        const acceptButton = await page.$('#root > div > div.cookies.cookies--shown > div > div.cookies__accept > a')
        await acceptButton.click()
        await page.waitForTimeout(1000);
    } catch (err) {
        console.log("Error during clicking cookie pop-up => : ", err);
    }
    console.log("logging in")
    let success = true;
    try {
        const signInButton = await page.$('#sign-buttons__sign-in');
        await signInButton.click()
        await page.waitForTimeout(2000);

        const emailInput = await page.$('#sign-in__email');
        await emailInput.type(email);
        await page.waitForTimeout(2000);

        const pwdInput = await page.$('#sign-in__password');
        await pwdInput.type(pwd);
        await page.waitForTimeout(2000);

        const loginButton = await page.$('#sign-in__submit')
        await loginButton.click()
        await page.waitForTimeout(3000);
        console.log('logged in')
    } catch (err) {
        console.log("Error during logging in => : ", err);
        success = false;
    }
    return success;
}

async function getFollowingDates(days){
    let dates = []
    try {
        for (day of days) {
            currentDate = new Date();
            console.log(currentDate);
            console.log(day);
            if (currentDate.getDay() == day) {
                currentDate.setDate(currentDate.getDate() + 1);
                var resultDate = new Date(currentDate.getTime());
                resultDate.setDate(currentDate.getDate() + (7 + day - currentDate.getDay()) % 7);
            }
            else {
                var resultDate = new Date(currentDate.getTime());
                resultDate.setDate(currentDate.getDate() + (7 + day - currentDate.getDay()) % 7);
            }
            dates.push(resultDate);
        }
    } catch (err) {
        console.log("Error during calculating next dates => : ", err);
    }
    return dates
}

async function getId(clubUrl){
    let clubId = ''
    try {
        let expression = new RegExp('[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}');
        var resultArray = expression.exec(clubUrl);
        clubId = resultArray[0];
    } catch (err) {
        console.log("Error during extracting club id => : ", err);
    }
    return clubId;
}

async function checkAvailability(dates, clubId, preferenceHours, duration){
    // https://playtomic.io/api/v1/availability?user_id=me&tenant_id=10b97870-7941-4b42-9533-73e27e0e4ab7&sport_id=PADEL&local_start_min=2020-12-16T00%3A00%3A00&local_start_max=2020-12-16T23%3A59%3A59
    console.log(preferenceHours);
    let availability = []
    var url = 'https://playtomic.io/api/v1/availability?tenant_id='
    url += clubId;
    url += '&sport_id=PADEL&local_start_min='
    for (date of dates) {
        availability[date.toISOString().slice(0, 10)] = []
        var fetchUrl = url;
        fetchUrl += date.toISOString().slice(0, 10);
        fetchUrl += 'T00%3A00%3A00&local_start_max=';
        fetchUrl += date.toISOString().slice(0, 10);
        fetchUrl += 'T23%3A59%3A59';
        console.log(fetchUrl);
        const res = await fetch(fetchUrl);
        const text = await res.text();
        const jsonRes = JSON.parse(text);

        if (jsonRes.length > 0) {
            available = {}
            for (let field of jsonRes) {
                for (let hour of preferenceHours){
                    for (let slot of field.slots) {
                        if ((slot.duration == duration) & (slot.start_time == hour)) {
                            available.field = field.resource_id;
                            available.time = slot.start_time;
                            available.duration = slot.duration;
                            availability[date.toISOString().slice(0, 10)].push(available);
                        }
                    }
                }
            }
        }
        else {
            console.log('No slots available for ' + date)
        }
    }
    return availability
}

async function tryToBook(page, padelClub, date, information) {
    /// https://playtomic.io/tennisclub-de-vallei/10b97870-7941-4b42-9533-73e27e0e4ab7?q=PADEL~2020-12-10~~~
    var url = padelClub;
    url += '?q=PADEL~';
    url += date;
    url += '~~~';
    console.log(`Navigating to ${url}...`);
    await page.goto(url);
    await page.waitForTimeout(2000);

    let timecolumns = await page.$('#root > div > div.page > div.page__body > div.page__content > div > div.new_tenant__body > div.new_tenant__main > div:nth-child(1) > div > div.bbq2__grid > div.bbq2__availability > div.bbq2__hours')
    // await page.evaluate('document.querySelector("span.styleNumber").getAttribute("data-Color")')
    // const attr = await page.$$eval("span.styleNumber", el => el.map(x => x.getAttribute("data-Color")));
    let timeslots = await page.$eval('div.bbq2__hour', el => el.textContent);
    console.log(timeslots)

}

async function calculateLeft() {

}

(async function() {
    //Start the browser and create a browser instance
    let browser = await browserObject.startBrowser();

    // Pass the browser instance to the scraper controller
    // await scraperController(browserInstance)

    let page = await browser.newPage();

    // Login
    // let success = await logIn(page, config.email, config.password);
    // if (success) {
    //     console.log('Success');
    // };

    // Get dates of the upcoming booking dates
    let dates = await getFollowingDates(config.days);
    console.log(dates);

    // Get Club Id for Playtomic
    let clubId = await getId(config.padel_club);

    let available = await checkAvailability(dates, clubId, config.preference, config.duration);
    console.log(available);

    await tryToBook(page, config.padel_club, '2020-12-16', '')
    
    console.log('Done');
})();