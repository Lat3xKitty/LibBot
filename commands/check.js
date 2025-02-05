const { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } = require('discord.js');
const axios = require("axios");
const cheerio = require("cheerio");

const cooldownTimeout = 36000 * 100; // 1 hour

module.exports = {
	data: new SlashCommandBuilder()
		.setName('check')
		.setDescription('Checks for Deals on Libidex and Latex Express!'),
        
    /**
     * @param {ChatInputCommandInteraction} interaction 
     */
	async execute(interaction) {
        // Create a map to store the server timeouts
        if (interaction.client.serverTimeouts === undefined) {
            interaction.client.serverTimeouts = new Map();
        }

        const serverTimeout = interaction.client.serverTimeouts.get(interaction.guildId);
        const isOnTimeout = serverTimeout && ((new Date()).getTime() - serverTimeout) < cooldownTimeout;

        if (isOnTimeout) {
            // Work out the time left on the cooldown
            var timeLeft = cooldownTimeout - ((new Date()).getTime() - serverTimeout);
            var timeLeftMinutes = Math.floor(timeLeft / 60000);
            var timeLeftSeconds = Math.floor((timeLeft - (timeLeftMinutes * 60000)) / 1000);

            // Send a message saying how long is left
            await interaction.reply({
                content: 'Please wait ' + timeLeftMinutes + ' minutes and ' + timeLeftSeconds + ' seconds before using this command again.',
                ephemeral: true
            }
            );
            return;
        }
        
        // Set the cooldown
        interaction.client.serverTimeouts.set(interaction.guildId, (new Date()).getTime());

        // ----------------------------------------------

		await interaction.deferReply();

        var libidexData = await scrapeData('https://www.libidex.com');

        if (libidexData && libidexData.title) {
            // inside a command, event listener, etc.
            let limitedDescription = (
                libidexData.description.length > 1024
                    ? libidexData.description.substring(0, 1021) + '...'
                    : libidexData.description
            )

            const embedsToSend = [
                new EmbedBuilder()
                    .setColor('#000001')
                    .setTitle('Deal of the Day @ Libidex!')
                    .setURL(libidexData.url)
                    .setDescription(
                        'Today\'s Deal is 50% off **'+ libidexData.title +'**!\n' + 
                        '  Was: **' + libidexData.oldPrice + '**\n' +
                        '  Now: **' + libidexData.newPrice + '**'
                    )
                    .setFields([
                        { name: 'Description',      value: limitedDescription },
                        { name: 'Selectable Options', value: libidexData.selectableOptions.join(', ') },
                        { name: 'Model Name',       value: libidexData.modelName, inline: true },
                        { name: 'Main Thickness',   value: libidexData.mainThickness, inline: true },
                    ])
                    .setImage(libidexData.images[0])
                    .setTimestamp()
            ];

            if (libidexData.images.length > 1)
                embedsToSend.push(
                    new EmbedBuilder()
                        .setImage(libidexData.images[1])
                        .setURL(libidexData.url)
                );

            if (libidexData.images.length > 2)
                embedsToSend.push(
                    new EmbedBuilder()
                        .setImage(libidexData.images[2])
                        .setURL(libidexData.url)
                );

            // if (libidexData.images.length > 3)
            //     embedsToSend.push(
            //         new EmbedBuilder()
            //             .setImage(libidexData.images[3])
            //             .setURL(libidexData.url)
            //     );

            await interaction.editReply({ embeds: embedsToSend });
        }
        

        // var latexExpressData = await scrapeData('https://www.latexexpress.com');

        // if (latexExpressData && latexExpressData.title) {
        //     const exampleEmbed2 = new EmbedBuilder()
        //         .setColor('#F9427A')
        //         .setTitle('Deal of the Day @ LatexExpress!')
        //         .setURL(latexExpressData.url)
        //         .setDescription(
        //             'Today\'s Deal is ' + latexExpressData.deal + ' off **'+ latexExpressData.item_name +'**!\n' +
        //             'Was: **' + latexExpressData.old_price + '**\n' +
        //             'Now: **' + latexExpressData.new_price + '**'
        //         )
        //         .setImage(latexExpressData.image_url)
        //         .setTimestamp();
    
        //     await interaction.channel.send({ embeds: [exampleEmbed2] });
        // }

        if ((!libidexData || !libidexData.title)) { // && (!latexExpressData || !latexExpressData.item_name)
            await interaction.editReply('No deals found today!');
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

        return false;
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
        // Find image with src =  https://libidex.com/media/wysiwyg/libi_2.jpg
        var dealImage = $("img[src='https://libidex.com/media/wysiwyg/libi_2.jpg']");
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

            case "choose your secondary colour": label = "Second Colour";
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