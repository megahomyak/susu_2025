import * as nodeHtmlParser from "node-html-parser";
import * as fsPromises from "node:fs/promises";

let parse = root => {
    let results = [];
    for (let item of root.findByClass("block-edu")) {
        let institution = item.findByClass("school")[0].text;
        let program = item.findByClass("edu-title")[0].text;
        let profile = item.findByClass("profile")[0]?.findByClass("info-text")[0].text ?? null;
        let detailsUrl = item.findByClass("btn-action")[0].getAttribute("href");
        let fundedPlaces = item.findByClass("funded-places")[0];
        {
            let infoLabel = fundedPlaces.findByClass("info-label")[0];
            if (infoLabel != undefined && infoLabel.text == "Контракт (мест)") {
                let contractPlaces = fundedPlaces.findByClass("info-text")[0].text;
                results.push({ contractPlaces, institution, profile, program });
            } else {
                continue;
            }
        }
    }
    return results;
};

let parsed = parse(await (async () => {
    let root = nodeHtmlParser.parse(await fsPromises.readFile("edu_programs.html", "utf8"));
    let makeElement = el => ({
        findByClass: className => el.querySelectorAll("." + className).map(makeElement),
        get text() {
            return el.textContent.trim();
        },
        getAttribute: attributeName => el.getAttribute(attributeName),
    });
    return makeElement(root);
})());

console.log(parsed);
