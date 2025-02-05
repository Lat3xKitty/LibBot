const { SlashCommandBuilder, ChatInputCommandInteraction } = require('discord.js');
const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");

const { TwitterApi } = require('twitter-api-v2');
const _client = new TwitterApi({
    appKey: process.env.API_KEY,
    appSecret: process.env.API_SECRET,
    accessToken: process.env.ACCESS_TOKEN,
    accessSecret: process.env.ACCESS_SECRET
});
const _bearer = new TwitterApi(process.env.BEARER_TOKEN);
const twitterClient = _client.readWrite;
const twitterBearer = _bearer.readOnly;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tweetcheck')
		.setDescription('Tweet Deals on Libidex and Latex Express!'),

    /**
     * @param {ChatInputCommandInteraction} interaction
     */
	async execute(interaction) {
        if (interaction.user.id !== "211158782883921921" && interaction.user.id !== "183931930935427073") {
            await interaction.reply({
                content: 'This command is locked to my Masters only.',
                ephemeral: true
            });
            return;
        }

		await interaction.deferReply();

        var libidexData = await scrapeData('https://www.libidex.com');

        if (libidexData.title) {
            // Upload images to Twitter
            const image = getUrlContents(libidexData.images[0]);
            const mediaId = await twitterClient.v1.uploadMedia(image, { mimeType: 'image/png' });

            // Tweet the deal
            var tweet = await twitterClient.v2.tweet(
                {
                    text: `Today's Libidex deal is 50% off ${libidexData.title}!\n` +
                        `  Was: ${libidexData.oldPrice}\n` +
                        `  Now: ${libidexData.newPrice}\n\n` +

                        `Check it out at ${libidexData.url}`,
                    media: {
                        media_ids: [mediaId]
                    }
                }
            );

            // Reply to the tweet
            var reply = await twitterClient.v2.reply(
                (
                    `Description: ` +
                        (libidexData.description.length >= (280 - 13)
                        ?   libidexData.description.substring(0, 280 - 30) + '...'
                        :   libidexData.description)
                ),
                tweet.data.id
            );
        }


        // var latexExpressData = await scrapeData('https://www.latexexpress.com');

        // if (latexExpressData.item_name) {
        //     // Upload images to Twitter
        //     const image = getUrlContents(latexExpressData.image_url);
        //     const mediaId = await twitterClient.v1.uploadMedia(image, { mimeType: 'image/png' });

        //     // Tweet the deal
        //     twitterClient.v2.tweet(
        //         {
        //             text: `Today's Latex Express deal is ${latexExpressData.deal} off ${latexExpressData.item_name}!\n` +
        //                 `  Was: ${latexExpressData.old_price}\n` +
        //                 `  Now: ${latexExpressData.new_price}\n\n` +

        //                 `Check it out at ${latexExpressData.url}`,
        //             media: {
        //                 media_ids: [mediaId]
        //             }
        //         }
        //     );
        // }

        // (!latexExpressData || !latexExpressData.item_name)
        if ((!libidexData || !libidexData.title)) {
            await interaction.editReply('No deals found today!');
        }
        else {
            await interaction.editReply(
                'Deals have been tweeted ;) \n' +
                "https://twitter.com/Latex_deals/status/" + tweet.data.id
            );
        }
	},
};


// Async function which scrapes the data
/**
 *
 * @param {String} url
 * @returns {DealObject}
 */
async function scrapeDataOld(url) {
    const outputData = {};
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        var owl_slides = $('body div.banner-container .owl-carousel .item');

        // Loop through each slide and see if it contains a `.old-price` element
        owl_slides.each(function(i, elem) {
            var old_price = $(this).find('.old-price');
            if (old_price.length) {


                outputData.deal = $('h4', this).text();

                var item_and_price = $('h6', this).text().trim();
                var item_and_price_split = item_and_price.split(' - ');
                outputData.item_name = item_and_price_split[0].trim();

                outputData.old_price = old_price.text();
                outputData.new_price = (
                    item_and_price_split[1]
                        .replace(outputData.old_price, '')
                        .trim()
                );

                outputData.url = $('a.slider-cta', this).attr('href');
                outputData.image_url = $('img.owl-hero-right', this).attr('src');

                // End Loop
                return false;
            }
        });
    }
    catch (err) {
        console.error(err);
    }

    return outputData;
}

/**
 * 
 * @param {String} url 
 * @returns {DealObject2}
 */
async function scrapeData(url) {
    // use axios to get the html of the page
    const { data } = await axios.get(url);

    // use cheerio to parse the html
    var $ = cheerio.load(data);
    // #html-body > div.page-wrapper > div.p-0.mb-0 > div > div > div > div > a
    var dealImage = $("#html-body > div.page-wrapper > div.p-0.mb-0 > div > div > div > div > a");

    var redirectUrl = '';
    if (dealImage) {
        var dealImageSrc = dealImage.attr("href");
        redirectUrl = dealImageSrc;
    }
    else {
        // Find image with src =  https://libidex.com/media/wysiwyg/Daily_Deal_50_OFF_2023.jpg
        var dealImage = $("img[src='https://libidex.com/media/wysiwyg/Daily_Deal_50_OFF_2023.jpg']");
        var parentAnchor = dealImage.parent();
        redirectUrl = parentAnchor.attr("href");
    }

    if (!redirectUrl) {
        return false;
    }

    // ----------------------------------------------

    // use axios to get the html of the page
    const { data: dealData } = await axios.get(redirectUrl);

    // use cheerio to parse the html
    var $ = cheerio.load(dealData);

    $(".product.attribute.description .value table").remove();

    var retData = {
        url         : redirectUrl,
        title       : $("h1.page-title span").text(),
        oldPrice    : $(".product-info-main > .price-box .price-wrapper[data-price-type='oldPrice'] .price").text(),
        newPrice    : $(".product-info-main > .price-box .price-wrapper[data-price-type='finalPrice'] .price").text(),
        description : $(".product.attribute.description .value").text(),

        images      : $(".MagicToolboxContainer a.mt-thumb-switcher")
                        .map((i, el) => $(el).attr("href")).toArray(),

        modelName         : $(".modelbio_main h5").text() || '*No Model listed*',
        mainThickness     : $(".main_latex_thickness span").text(),
        selectableOptions : []
    };

    // Loop through all the swatchTabHeader labels and add them to the selectableOptions
    $("#element .swatchTabHeader").each((i, el) => {
        var label = $(el).find('label.label').text();

        // remove the (number). from the start and trim
        label = label.trim().replace(/^\d+\.\s/, "").trim().toLowerCase();

        switch(label) {
            case "choose your main colour":     label = "Main Colour";
                break;

            case "choose your secondary colour":   label = "Second Colour";
                break;

            case "choose your trim colour":     label = "Trim Colour";
                break;

            case "choose your zip style":       label = "Zip Style";
                break;

            case "choose your size":            label = "Size";
                break;

            case "choose your length":          label = "Length (Petite, Regular, Tall)";
                break;

            case "choose your feet style":      label = "Feet Style";
                break;

            case "size hood":                   label = "Hood Size";
                break;

            default:                            label.replace("choose your ", "");
                break;
        }

        retData.selectableOptions.push(label);
    });

    return retData;
}

/**
 *
 * @param url
 * @returns Promise<string>
 */
function getUrlContents(url) {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        const data = []
        res.on("data", (chunk) => {
          data.push(chunk);
        });

        res.on("end", () => {
          resolve(Buffer.concat(data));
        });
        res.on("error", (err) => {
          reject(err);
        });
      });
    });
}


// Create JS Docs for DealObject
/**
 * @typedef {Object} DealObject
 * @property {string} deal
 * @property {string} item_name
 * @property {string} old_price
 * @property {string} new_price
 * @property {string} url
 * @property {string} image_url
 */

/**
 * @typedef {Object} DealObject2
 * @property {string} url
 * @property {string} title
 * @property {string} oldPrice
 * @property {string} newPrice
 * @property {string} description
 * 
 * @property {string[]} images
 * 
 * @property {string} modelName
 * @property {string} mainThickness
 * @property {string[]} selectableOptions
 */