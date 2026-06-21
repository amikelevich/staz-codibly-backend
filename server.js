const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/energy-mix", async (req, res) => {
  try {
    const today = new Date().setHours(0, 0, 0, 0);
    today.toISOString();
    const dateStart = today.toISOString();
    const end = new Date(today);
    end.setDate(end.getDate() + 3);
    const dateEnd = end.toISOString();

    const response = await axios.get(
      `https://api.carbonintensity.org.uk/generation/${dateStart}/${dateEnd}`,
    );

    const cleanEnergySources = ["biomass", "nuclear", "hydro", "wind", "solar"];
    const groupedByDate = {};
    response.data.data.forEach((interval) => {
      const date = interval.from.split("T")[0];
      if (!groupedByDate[date]) {
        groupedByDate[date] = {
          intervalCount: 0,
          energyMix: {},
        };
      }

      groupedByDate[date].intervalCount += 1;
      interval.generationmix.forEach((source) => {
        if (!groupedByDate[date].energyMix[source.fuel]) {
          groupedByDate[date].energyMix[source.fuel] = 0;
        }
        groupedByDate[date].energyMix[source.fuel] += source.perc;
      });
    });
    const results = [];
    Object.keys(groupedByDate).forEach((date) => {
      const day = groupedByDate[date];
      const dailyMix = [];
      let cleanEnergyPercentage = 0;
      Object.keys(day.energyMix).forEach((fuel) => {
        const averagePerc = day.energyMix[fuel] / day.intervalCount;
        dailyMix.push({ fuel: fuel, perc: averagePerc });
        if (cleanEnergySources.includes(fuel)) {
          cleanEnergyPercentage += averagePerc;
        }
      });
      results.push({
        date: date,
        mix: dailyMix,
        result: cleanEnergyPercentage,
      });
    });
    res.json(results);
  } catch (error) {
    console.error("Błąd podczas pobierania danych:", error);
    res.status(500).json({ error: "Wystąpił błąd podczas pobierania danych." });
  }
});

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
