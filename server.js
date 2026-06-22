const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/energy-mix", async (req, res) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const dateStart = today.toISOString().substring(0, 16) + "Z";
    const end = new Date(today);
    end.setUTCDate(end.getUTCDate() + 3);
    const dateEnd = end.toISOString().substring(0, 16) + "Z";

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
    const apiError = error.response ? error.response.data : error.message;
    console.error("Błąd podczas pobierania danych:", apiError);
    res.status(500).json({
      error: "Wystąpił błąd podczas pobierania danych.",
      details: apiError,
    });
  }
});

app.get("/optimal-window/:hours", async (req, res) => {
  try {
    const hours = parseInt(req.params.hours);

    if (hours >= 1 && hours <= 6) {
      const requiredIntervals = hours * 2;

      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      start.setUTCDate(start.getUTCDate() + 1);
      const dateStart = start.toISOString().substring(0, 16) + "Z";
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 2);
      const dateEnd = end.toISOString().substring(0, 16) + "Z";

      const response = await axios.get(
        `https://api.carbonintensity.org.uk/generation/${dateStart}/${dateEnd}`,
      );

      const cleanEnergySources = [
        "biomass",
        "nuclear",
        "hydro",
        "wind",
        "solar",
      ];
      const intervals = response.data.data.map((interval) => {
        let cleanEnergyPercentage = 0;
        interval.generationmix.forEach((source) => {
          if (cleanEnergySources.includes(source.fuel)) {
            cleanEnergyPercentage += source.perc;
          }
        });
        return {
          from: interval.from,
          to: interval.to,
          cleanEnergyPercentage: cleanEnergyPercentage,
        };
      });

      let maxAverage = 0;
      let optimalStart = null;
      for (let i = 0; i <= intervals.length - requiredIntervals; i++) {
        let currentSum = 0;
        for (let j = 0; j < requiredIntervals; j++) {
          currentSum += intervals[i + j].cleanEnergyPercentage;
        }
        const currentAverage = currentSum / requiredIntervals;
        if (currentAverage > maxAverage) {
          maxAverage = currentAverage;
          optimalStart = {
            from: intervals[i].from,
            to: intervals[i + requiredIntervals - 1].to,
            averageCleanEnergy: maxAverage,
          };
        }
      }
      res.json(optimalStart);
    } else {
      res.status(400).json({
        error: "Nieprawidłowa liczba godzin. Proszę podać wartość od 1 do 6.",
      });
    }
  } catch (error) {
    const apiError = error.response ? error.response.data : error.message;
    console.error("Błąd podczas pobierania danych:", apiError);
    res.status(500).json({
      error: "Wystąpił błąd podczas pobierania danych.",
      details: apiError,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
