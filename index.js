const cheerio = require("cheerio");

const toUl = (textArray) =>
  `<ul>${textArray.map((text) => `<li>${text}</li>`).join("\n")}</ul>`;

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
    fetchers.map(async ({ url, transformer }) => {
      try {
        const html = await fetchData(url);

        return await transformer(parseHTML(html));
      } catch (error) {
        console.error("Error fetching or parsing the HTML:", error);
      }
    })
  );

  console.log(results.join("\n\n"));
}

main();
