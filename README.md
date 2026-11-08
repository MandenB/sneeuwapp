# Alpine Report

A ski-weather overview for the European Alps. Type a resort, village, or nearby town and choose a matching Alpine location to see:

- Current conditions and temperature
- Estimated new snowfall over the next 24 hours
- Modelled snow depth, cloud cover, wind direction, speed, and gusts
- An OpenSnow-inspired model chart (up to 16 days where available) with an adjustable day-range slider, clickable values for each available model, and tabs for snowfall, predicted snow depth, cloud cover, temperature, and wind speed
- Forecast and historical snow-depth graphs with separate selected-location and upper-mountain elevation tabs
- A historical snow-depth graph with selectable October–September seasons, showing daily archive values where available
- Separate forecast values for the selected location elevation and an adjustable upper-mountain elevation
- A ten-day, day/night forecast table with snowfall bars, cloud cover, wind, and temperature
- A comparison of available weather models and their mean

Location search uses Open-Meteo geocoding and filters results to the Alpine region. The location forecast uses the selected point and its geocoded elevation. The upper-mountain forecast uses the same coordinates at a separately adjustable elevation, initially set 1,200 m higher (up to 4,500 m). Neither point represents every elevation or terrain feature in a resort.

Weather data is provided by [Open-Meteo](https://open-meteo.com/) with no API key. The app requests a catalogue of known global and Alpine regional model feeds, then displays models that return data for the selected location and chart variable. The graph extends through the longest available forecast for the selected variable (up to 16 days) and does not fill unavailable model data. Click or focus the graph and use the arrow keys to inspect each model at a forecast time. Model availability and forecast duration vary by location and variable; shorter coverage is marked. The catalogue may not include every model Open-Meteo adds. A mean uses available model data and is a guide, not a separate forecast or certainty.

The predicted snow-depth graph uses each available model's hourly snow-depth forecast, displayed in centimetres at 12-hour intervals. It represents estimated snow on the ground, not new snowfall, and is only shown for models that return data for the selected elevation.

The historical snow-depth tab requests the selected October–September season from Open-Meteo's Historical Weather API when opened. It offers the current season and nine previous seasons, and plots the last available hourly reading for each local date at either selected elevation; historical model estimates may differ from measurements at the resort.

## Get started

```sh
npm install
npm run dev
```

## Build and check

```sh
npm run build
npm run lint
```
