import * as nodeHtmlParser from "node-html-parser";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import * as fastCsv from "fast-csv";

let make = async (filePath, maker) => {
    try { await fsPromises.stat(filePath); }
    catch { await fsPromises.mkdir(path.dirname(filePath), { recursive: true }); await maker(filePath); }
    return filePath;
};

let makeEduPrograms = async outpath => {
    let outfile = await fsPromises.open(outpath, "w");
    let offset = 0;
    while (true) { 
        let newEntries = await (await fetch('https://abit.susu.ru/wp-admin/admin-ajax.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            },
            body: `action=edu_prog&data=extra%255Bedu-area-name%255D%3D%26extra%255Bedu-form%255D%3D%26extra%255Bedu-level%255D%3D%26extra%255Bdivision%255D%3D%26extra_fields_nonce%3Da6daed7bb8%26type-page%3Darchive&offset=${offset}`,
        })).text();
        if (newEntries == "") {
            outfile.close();
            return;
        } else {
            outfile.write(newEntries);
            offset += 10;
        }
    }
};

let parseAnyPage = text => {
    let root = nodeHtmlParser.parse(text);
    let makeElement = el => ({
        findByClass: className => el.querySelectorAll("." + className).map(makeElement),
        findByTag: tagName => el.querySelectorAll(tagName).map(makeElement),
        get text() {
            return el.textContent.trim();
        },
        get children() {
            return el.children.map(makeElement);
        },
        getAttribute: attributeName => el.getAttribute(attributeName),
    });
    return makeElement(root);
};

let getEduProgramsUrls = mainPageRoot => mainPageRoot.findByClass("block-edu").map(el => el.findByClass("btn-action")[0].getAttribute("href"));

let getEduProgramAttributes = eduProgramPageRoot => new Map(eduProgramPageRoot.findByClass("table-edu")[0].findByTag("tbody")[0].children.map(attr => [attr.findByTag("th")[0].text, attr.findByTag("td")[0].text]));

{
    let read = fsPromises.readFile;
    let write = fsPromises.writeFile;
    let eduProgramsPath = await make("edu_programs.html", async filePath => {
        await makeEduPrograms(filePath);
    });
    await make("edu_programs.csv", async outpath => {
        let eduProgramsUrls = getEduProgramsUrls(parseAnyPage(await read(eduProgramsPath)));
        let eduProgramsHeaders = [];
        let eduProgramsRows = [];
        for (let [i, url] of eduProgramsUrls.entries()) {
            let eduProgramPath = await make(`edu_programs/${i}.html`, async filePath => {
                await write(filePath, (await fetch(url)).body);
            });
            let eduProgramAttributes = getEduProgramAttributes(parseAnyPage(await read(eduProgramPath, "utf8")));
            let eduProgramCols = [];
            for (let header of eduProgramsHeaders) {
                let v = eduProgramAttributes.get(header);
                if (v == undefined) {
                    v = "";
                } else {
                    eduProgramAttributes.delete(header);
                }
                eduProgramCols.push(v);
            }
            for (let [k, v] of eduProgramAttributes.entries()) {
                eduProgramsHeaders.push(k);
                eduProgramCols.push(v);
            }
            eduProgramsRows.push(eduProgramCols);
        }
        await fsPromises.writeFile(outpath, fastCsv.write([
            eduProgramsHeaders,
            ...eduProgramsRows,
        ]));
    });
}
