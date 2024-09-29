const cheerio = require("cheerio");
const { XMLParser } = require("fast-xml-parser");

const config = require("./config.js");

const parser = new XMLParser();

const now = new Date();
const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  .toISOString()
  .split("T")[0];

const toUl = (textArray) =>
  `${textArray.map((text) => `* ${text}`).join("\n")}`;

const numOutOfFiveToStarCharacters = (num) => {
  let string = "";
  let floor = Math.floor(num);
  string += "★".repeat(floor);

  if (floor !== num) {
    string += "½";
  }

  return string.padEnd(5, "☆");
};

function daysInMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  return new Date(year, month, 0).getDate();
}

const currentDate = new Date();
const currentMonth = currentDate.getMonth() + 1;
const currentYear = currentDate.getFullYear();

const fetchers = [
  {
    url: "https://leadership.joewoods.dev/rss/",
    async transformer() {
      try {
        const response = await fetch("https://leadership.joewoods.dev/rss/");
        const xmlData = await response.text();
        const parsedData = parser.parse(xmlData);

        const items = parsedData.rss.channel.item;

        const filteredItems = Array.isArray(items)
          ? items.filter((item) => {
              const pubDate = new Date(item.pubDate);
              return (
                pubDate.getMonth() + 1 === currentMonth &&
                pubDate.getFullYear() === currentYear
              );
            })
          : [];

        const formattedData = filteredItems.reverse().map((item) => {
          return `* [${item.title}](${item.link})`;
        });

        if (!formattedData.length) {
          return `! No leadership posts for this month!`;
        }

        return "## writing\n\n" + formattedData.join("\n");
      } catch (error) {
        console.error("Error fetching or parsing RSS feed:", error);
        return "There was an error fetching or parsing the RSS feed.";
      }
    },
  },
  {
    url: "https://letterboxd.com/tjwds/films/diary/",
    transformer($) {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = (currentDate.getMonth() + 1)
        .toString()
        .padStart(2, "0");

      const currentYearMonth = `${currentYear}/${currentMonth}`;

      const rows = Array.from($(".diary-entry-row")).filter((row) => {
        const rowElement = $(row);
        const children = rowElement.find(".diary-day > a");

        return children[0]?.attribs["href"]?.includes(currentYearMonth);
      });

      const rowsFormatted = rows.reverse().map((element) => {
        const $el = $(element);
        let row =
          $el.find(".headline-3").text() +
          " — " +
          ($el.find(".td-rewatch.icon-status-off").length
            ? ""
            : " (rewatch) ") +
          ($el
            .find(".td-rating")
            .text()
            .trim()
            .slice(1)
            .trim()
            .padEnd(5, "☆") || "(no rating)");
        return row;
      });

      if (!rowsFormatted.length) {
        return "I didn't watch any films this month!";
      }
      return (
        "## films\n\n" +
        `This month, I watched ${rowsFormatted.length} film${
          rowsFormatted.length === 1 ? "" : "s"
        }:\n\n` +
        toUl(rowsFormatted) +
        '\n\nHave I mentioned that I love Letterboxd?  <a href="https://letterboxd.com/tjwds/">You can follow me there.</a>'
      );
    },
  },
  {
    jsonUrl: "https://api.hardcover.app/v1/graphql",
    headers: {
      authorization: config.hardcoverAuthorization,
    },
    method: "POST",
    body: JSON.stringify({
      query: `query MyQuery {
        user_book_reads(
          where: {user_book: {user: {id: {_eq: 16056}}, status_id: {_eq: 3}}, finished_at: {_gte: "${firstDayOfMonth}"}}
        ) {
          user_book {
            book {
              title
              contributions {
                author {
                  name
                }
              }
            }
            rating
          }
        }
      }
    `,
    }),
    transformer(result) {
      const rowsFormatted = result.data.user_book_reads
        .reverse()
        .map((entry) => {
          const authors = entry.user_book.book.contributions
            .map((contrib) => contrib.author.name)
            .join(", ");

          let row = `<i>${entry.user_book.book.title}</i> by ${authors}`;

          if (entry.user_book.rating !== null) {
            row += ` — ${numOutOfFiveToStarCharacters(entry.user_book.rating)}`;
          } else {
            row += " — No rating";
          }

          return row;
        });

      if (!rowsFormatted.length) {
        return "I didn't finish any books this month!";
      }
      return (
        "## books\n\n" +
        `This month, I finished ${rowsFormatted.length} book${
          rowsFormatted.length === 1 ? "" : "s"
        }:\n\n` +
        toUl(rowsFormatted) +
        "\n\n TODO mention any books I'm currently reading"
      );
    },
  },
  {
    url: "https://www.failbetter.com",
    transformer($) {
      const rows = Array.from($(".node-teaser")).filter((row) => {
        const rowElement = $(row);
        const children = rowElement.find(".submitted");

        const then = new Date(children.text().trim().slice(13));

        return (
          then.getFullYear() === now.getFullYear() &&
          then.getMonth() === now.getMonth()
        );
      });

      const rowsFormatted = rows.map((element) => {
        const $el = $(element);
        const $link = $el.find("h2 a");
        let row = `<a href="https://failbetter.com${
          $link[0].attribs.href
        }">"${$link.text().trim()}"</a> by ${$el
          .find(".field-name-field-author")
          .text()
          .trim()}`;

        return row;
      });

      if (!rowsFormatted.length) {
        return "No publications from _failbetter_ this month.";
      }
      return (
        "## _failbetter_\n\n" +
        `This month, _failbetter_ published:\n\n` +
        toUl(rowsFormatted)
      );
    },
  },
  {
    jsonUrl: `https://whatpulse.org/ajax/json/user/pulse/list/132366?view=custom&computerid=1408253&datefrom=${now.getFullYear()}-${(
      now.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}-01&dateto=${now.getFullYear()}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${daysInMonth(
      now
    )}&pulses_groupby=month&pulses_filterby=allcomputers&_=1703174744205`,
    transformer(data) {
      const numbers = data.data.reduce(
        (previous, wpObject) => {
          previous.clicks = previous.clicks + Number(wpObject.clicks.sort);
          previous.keys = previous.keys + Number(wpObject.keys.sort);

          return previous;
        },
        {
          clicks: 0,
          keys: 0,
        }
      );

      return `## stats \n\nThis month:\n\n* I typed ${numbers.keys} keys and clicked ${numbers.clicks} times.`;
    },
  },
  // {
  //   url: `https://www.last.fm/user/woodsjoe/library?from=${now.getFullYear()}-${(
  //     now.getMonth() + 1
  //   )
  //     .toString()
  //     .padStart(2, "0")}-01-01&rangetype=1month`,
  //   transformer($) {
  //     console.log($(".metadata-display"));
  //     return `* I listened to ${$(
  //       ".metadata-display"
  //     )[0].innerText.trim()} songs.`;
  //   },
  // },
];

async function fetchData(url) {
  const response = await fetch(url);
  const html = await response.text();
  return html;
}

function parseHTML(html) {
  return cheerio.load(html);
}

async function main() {
  const results = await Promise.all(
    fetchers.map(
      async ({ url, headers, transformer, jsonUrl, body, method }) => {
        if (jsonUrl) {
          const res = await fetch(jsonUrl, {
            headers,
            body,
            method: method || "GET",
          });
          const json = await res.json();

          return transformer(json);
        }

        const html = await fetchData(url);

        return transformer(parseHTML(html));
      }
    )
  );

  console.log(
    results.join("\n\n") +
      // unfortunately, you have to be logged in to get this; I'm okay with just
      // doing this manually, I suppose.
      `\n* I listened to TODO songs. go look at https://www.last.fm/user/woodsjoe/library?from=${now.getFullYear()}-${(
        now.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}-01&rangetype=1month`
  );
}

main();
