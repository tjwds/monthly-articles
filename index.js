const cheerio = require("cheerio");

const now = new Date();

const toUl = (textArray) =>
  `<ul>${textArray.map((text) => `<li>${text}</li>`).join("\n")}</ul>`;

function daysInMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  return new Date(year, month, 0).getDate();
}

const fetchers = [
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

      const rowsFormatted = rows.map((element) => {
        const $el = $(element);
        let row =
          $el.find(".headline-3").text() +
          " — " +
          ($el.find(".td-rewatch.icon-status-off").length
            ? ""
            : " (rewatch) ") +
          ($el.find(".td-rating").text().trim().slice(1).trim() ||
            "(no rating)");

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
    url: "https://www.goodreads.com/review/list/10363050-joe?shelf=read",
    transformer($) {
      const rows = Array.from($(".review")).filter((row) => {
        const rowElement = $(row);
        const children = rowElement.find(".date_added span");
        const then = new Date(children.text().trim());

        return (
          then.getFullYear() === now.getFullYear() &&
          then.getMonth() === now.getMonth()
        );
      });

      const rowsFormatted = rows.map((element) => {
        const $el = $(element);
        let row = `<i>${$el.find(".title .value a").text().trim()}</i> by ${$el
          .find(".author .value a")
          .text()
          .trim()} — TODO ${$el.find(".rating .value").text().trim()}`;

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
  // TODO last.fm
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
    fetchers.map(async ({ url, transformer, jsonUrl }) => {
      if (jsonUrl) {
        const res = await fetch(jsonUrl);
        const json = await res.json();

        return transformer(json);
      }

      const html = await fetchData(url);

      return transformer(parseHTML(html));
    })
  );

  console.log(results.join("\n\n"));
}

main();
