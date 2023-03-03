import * as retryAxios from "retry-axios";
import axios from "axios";
import { Client } from "@notionhq/client";
import * as dotenv from "dotenv";
import * as fs from "fs/promises";

dotenv.config();

const notion = new Client({
  auth: process.env.Notion_Secret,
});

retryAxios.attach();

// The IGDB API only returns 500 games per request.

var raw =
  "fields name,genres,platforms,first_release_date;\r\nwhere first_release_date < 1677598523 & first_release_date != null;\r\nsort first_release_date desc;\r\nlimit 500;";

var totalGames;
var skip = 0;
var games = [];

// Return all games based on the filter.

try {
  do {
    raw += "\r\noffset " + skip + ";";
    let response = await axios({
      url: "https://api.igdb.com/v4/games",
      data: raw,
      method: "POST",
      headers: {
        "Client-ID": process.env.Client_ID,
        Authorization: process.env.Authorization,
        "Content-Type": "text/plain",
      },
      timeout: 10000,
      raxConfig: {
        httpMethodsToRetry: ["POST"],
        retry: 10,
        noResponseRetries: 5,
        retryDelay: 1000,
        checkRetryAfter: true,
        onRetryAttempt: (error) => {
          const cfg = retryAxios.getConfig(error) || {};
          console.log("Retry Attempt" + cfg.currentRetryAttempt);
        },
        shouldRetry: (error) => {
          console.error(error);
          return true;
        },
      },
    });

    totalGames = response.headers["x-count"];
    games = [...games, ...response.data];

    let file = await fs.readFile("games.json", "utf8");
    let json = JSON.parse(file);

    json = [...json, ...response.data];
    
    // Write the games into a file. The file must exists.

    await fs.writeFile("games.json", JSON.stringify(json));
  } while (totalGames > games.length);
} catch (error) {
  console.log(error);
}

// Function to post a game into the previously created Notion Database and columns.

async function post(name) {
  const response = await notion.pages.create({
    parent: {
      database_id: process.env.Notion_Database_ID,
    },
    properties: {
      Title: {
        type: "title",
        title: [
          {
            type: "text",
            text: {
              content: name,
            },
          },
        ],
      },
      Genres: {
        type: "multi_select",
        multi_select: [
          {
            name: "Shooter",
          },
          {
            name: "RPG",
          },
        ],
      },
      Platform: {
        type: "select",
        select: {
          name: "PC",
        },
      },
      "Release Date": {
        type: "date",
        date: {
          start: "2021-05-11",
        },
      },
    },
  });
}
