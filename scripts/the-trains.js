/**
 * the-trains.js
 *
 * Copyright 2014 Michael Barry & Brian Card.  MIT open-source lincense.
 *
 * Display marey diagrams and map glyph for "The Trains" section of the
 * visualization in the following stages:
 *
 * 1. Load the required data and do some pre-processing
 * 2. Render the side map glyph that shows locations of trains at a point in time
 * 3. Set up the scaffolding for lined-up and full Marey diagrams
 * 4. On load and when the screen width changes:
 *   4a. Render the full Marey
 *   4b. Render annotations for the full Marey
 *   4c. Render the lined-up Marey
 *   4d. Set up listener to zoom in on a particular trip of the lined-up marey when user clicks on it
 * 5. Add interaction behavior with surrounding text
 *
 * Interaction is added to all elements throughout as they are rendered.
 */




/* 1. Load and pre-process the data
 *************************************************************/
VIZ.requiresData([
  'json!data/station-network.json',
  'json!data/spider.json',
  'json!data/marey-trips.json',
  'json!data/marey-header.json'
], true).progress(function (percent) {
  "use strict";
  d3.selectAll(".marey, .lined-up-marey").text('Loading train data... ' + percent + '%').style('text-align', 'center');
}).onerror(function () {
  "use strict";
  d3.select(".marey, .lined-up-marey").text('Error loading train data').style('text-align', 'center');
}).done(function (network, spider, trips, header) {
  "use strict";

  var stationToName = {};
  var end = {};
  var nodesPerLine = network.nodes.map(function (d) {
      var key = d.id + '|32';
      stationToName[key] = d.name;
      return key;
    });
  nodesPerLine = _.unique(_.flatten(nodesPerLine));

  var xExtent = d3.extent(d3.values(header), function (d) { return d[0]; });
  var minUnixSeconds = d3.min(d3.values(trips), function (d) { return d.begin; });
  var maxUnixSeconds = d3.max(d3.values(trips), function (d) { return d.end; });
  var mindate = new Date( minUnixSeconds);
  var maxdate = new Date( maxUnixSeconds);

  /* 3. Set up the scaffolding for lined-up and full Marey diagrams
   *************************************************************/
  var marey = d3.select(".marey").text('').style('text-align', 'left').append('svg');
  var mareyContainer = d3.select('.marey-container').classed('loading', false);
  d3.select(".lined-up-marey").text('');
  var timeDisplay = mareyContainer.selectAll('.marey-time');
  var tip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-10, 0])
      .html(function(d) { return d.name; });
  marey.call(tip);


  /* 4. On load and when the screen width changes
   *
   * This section makes heavy use of a utility defined in
   * common.js 'appendOnce' that when called adds a new element
   * or returns the existing element if it already exists.
   *************************************************************/
   // first some state shared across re-renderings
  var frozen = false;
  var showingMap = false;
  var highlightedTrip = null;
  var hoveredTrip = null;
  var lastWidth = null;

  // the method that actually gets called on screen size chages
  function renderMarey(outerSvg, fullMareyOuterWidth) {
    fullMareyOuterWidth = Math.round(fullMareyOuterWidth);
    if (fullMareyOuterWidth === lastWidth) { return; }
    lastWidth = fullMareyOuterWidth;

    /* 4a. Render the full Marey
     *************************************************************/
    var fullMareyMargin = {top: 100, right: 10, bottom: 0, left: 260};
    var fullMareyOuterHeight = 3000;
    var fullMareyWidth = fullMareyOuterWidth - fullMareyMargin.left - fullMareyMargin.right,
        fullMareyHeight = fullMareyOuterHeight - fullMareyMargin.top - fullMareyMargin.bottom;
    outerSvg.attr('width', fullMareyOuterWidth)
        .attr('height', fullMareyOuterHeight);

    var fullMareyHeader = outerSvg.appendOnce('g', 'header')
        .attr('transform', 'translate(' + fullMareyMargin.left + ',0)');
    var fullMareyBodyContainer = outerSvg.appendOnce('g', 'main')
        .attr('transform', 'translate(' + fullMareyMargin.left + ', ' + fullMareyMargin.top + ')');
    var fullMareyBackground = fullMareyBodyContainer.appendOnce('g', 'background');
    var fullMareyForeground = fullMareyBodyContainer.appendOnce('g', 'foreground');

    var xScale = d3.scale.linear()
        .domain(xExtent)
        .range([0, fullMareyWidth]);
    var yScale = d3.scale.linear()
      .domain([
        mindate,
        maxdate
      ]).range([15, fullMareyHeight]).clamp(true);

      console.log(minUnixSeconds);
    var timeScale = d3.time.scale()
      .domain([mindate, maxdate])
      .range([15, fullMareyHeight]);

    // draw the station label header aross the top
    var keys = d3.keys(header);
    var stationXScale = d3.scale.ordinal()
        .domain(keys)
        .range(keys.map(function (d) { return xScale(header[d][0]); }));
    var stationXScaleInvert = {};
    keys.forEach(function (key) {
      stationXScaleInvert[header[key][0]] = key;
    });

    var stationLabels = fullMareyHeader.selectAll('.station-label')
        .data(nodesPerLine);

    stationLabels
        .enter()
      .append('text')
        .attr('class', 'station-label')
        .style('display', function (d) { return end[d] ? null : 'none'; })
        .style('text-anchor', 'start')
        .text(function (d) { return VIZ.fixStationName(stationToName[d]); });

    stationLabels
        .attr('transform', function (d) { return 'translate(' + (stationXScale(d) - 2) + ',' + (fullMareyMargin.top - 3) + ')rotate(-70)'; });

//    stations
//        .enter()
//      .append('line')
//        .attr('class', function (d) { return 'station ' + d.replace('|', '-'); });
//
//    stations
//        .attr('x1', function (d) { console.log(d); return xScale(header[d][0]); })
//        .attr('x2', function (d) { return xScale(header[d][0]); })
//        .attr('y1', 0)
//        .attr('y2', fullMareyHeight);

    // draw the tall time axis down the side
    var yAxis = d3.svg.axis()
      .tickFormat(function (d) { return moment(d).zone(0).format("MMM Do YY, H:mm"); })
      .ticks(d3.time.minute, 15)
      .scale(timeScale)
      .orient("left");
    fullMareyForeground.appendOnce('g', 'y axis').call(yAxis);
    var lineMapping = d3.svg.line()
      .x(function(d) { return d[0]; })
      .y(function(d) { return d[1]; })
      .defined(function (d) { return d !== null; })
      .interpolate("linear");
    var mareyLines = fullMareyForeground.selectAll('.mareyline')
        .data(trips, function (d) { return d.trip; });

    if (!VIZ.ios) {
      fullMareyForeground.firstTime
          .onOnce('mouseover', 'path.mareyline', hoverTrain)
          .onOnce('mouseout', 'path.mareyline', unHoverTrain)
          .onOnce('click', 'path.mareyline', highlightTrain);
    }
    mareyLines
        .enter()
      .append('path')
        .attr('class', function (d) { return 'mareyline hoverable highlightable dimmable ' + d.line; });
    mareyLines
        .attr('transform', function (d) {
          if (!d.origY) { d.origY = yScale(d.stops[0].time); }
          return 'translate(0,' + d.origY + ')';
        })
        .attr('d', draw(xScale, yScale));
    mareyContainer.select('.fixed-right').on('mousemove', selectTime);
    mareyContainer.select('.fixed-right').on('mousemove.titles', updateTitle);
    var barBackground = fullMareyBackground.appendOnce('g', 'g-bar hide-on-ios');
    var barForeground = fullMareyForeground.appendOnce('g', 'g-bar hide-on-ios');
    barBackground.appendOnce('line', 'bar')
        .attr('x1', 1)
        .attr('x2', fullMareyWidth)
        .attr('y1', 0)
        .attr('y2', 0);
    barForeground.appendOnce('rect', 'text-background').firstTime
      .attr('x', 3)
      .attr('y', -14)
      .attr('width', 45)
      .attr('height', 12);
    barForeground.appendOnce('text', 'marey-time').firstTime
      .attr('dx', 2)
      .attr('dy', -4);
    timeDisplay = mareyContainer.selectAll('.marey-time');
    var bar = mareyContainer.selectAll("g.g-bar");


    // on hover, show the station you are hovered on
    function updateTitle() {
      var pos = d3.mouse(fullMareyForeground.node());
      var x = pos[0];
      var station = stationXScaleInvert[Math.round(xScale.invert(x))];
      if (station) {
        highlightMareyTitle(station)
      }
    }

    // on hover, set the time that is displayed in the map glyph on the side
    function selectTime() {
      var pos = d3.mouse(fullMareyForeground.node());
      var y = pos[1];
      var x = pos[0];
      if (x > 0 && x < fullMareyWidth) {
        var time = yScale.invert(y);
        select(time);
      }
    }

    // actually set the time for the map glyph once the time is determined
    function select(time) {
      var y = yScale(time);
      bar.attr('transform', 'translate(0,' + y + ')');
      timeDisplay.text(moment(time).zone(0).format('MMM Do YY h:mm a'));
    }

    // Get a list of [x, y] coordinates for all train trips for
    // both the full Marey and the lined-up Marey
    function getPointsFromStop(xScale, yScale, d, relative) {
      var stops = d.stops.map(function (stop) {
        var result = [stop];
        return result;
      });
      var flattenedStops = _.flatten(stops);
      var startX = xScale(header[d.stops[0].stop + '|' + d.line][0]);
      var points = flattenedStops.map(function (stop) {
        if (!stop) { return null; }

        var y = yScale(stop.time) - yScale(flattenedStops[0].time);
        var x = xScale(header[stop.stop + '|' + d.line][0]);
        if (relative) {
          x -= startX;
        }
        return [x, y];
      });
      return points;
    }
    function draw(xScale, yScale, relative) {
      return function (d) {
        var points = getPointsFromStop(xScale, yScale, d, relative);
        return lineMapping(points);
      };
    }




    /* 4d. Set up listener to zoom in on a particular trip of the lined-up marey when user clicks on it
     *************************************************************/
    if (!VIZ.ios) {
      d3.selectAll('.lined-up-marey')
          .on('click.toggle', function () { freezeHighlightedMarey(null, !frozen); });
    }

  }


  /* Bootstrap the Visualization - and re-render on width changes
   *************************************************************/
  VIZ.watchFixedRight(function (width) {
    showingMap = true;
    renderMarey(marey, width);
  });



  /* Miscellaneous Utilities
   *************************************************************/
  function highlight() {
    mareyContainer.classed('highlight-active', !!highlightedTrip);
    mareyContainer.selectAll('.highlightable')
      .classed('active', function (d) { return d.trip === highlightedTrip; });
  }
  function highlightTrain(d) {
    if (d === null) {
      highlightedTrip = null;
    } else {
      highlightedTrip = d.trip;
    }
    highlight();
    d3.event.stopPropagation();
  }
  function unHoverTrain() {
    hoveredTrip = null;
    hover();
  }
  function hoverTrain(d) {
    hoveredTrip = d.trip;
    hover();
  }

  function hover() {
    d3.selectAll('.hoverable')
      .classed('hover', function (d) { return d.trip === hoveredTrip; });
  }
  function highlightMareyTitle(title, lines) {
    var titles = {};
    titles[title] = true;
    if (lines) {
      lines.forEach(function (line) { titles[title + "|" + line] = true; });
    } else if (title) {
      titles[title] = true;
      titles[title.replace(/\|.*/, '')] = true;
    }
    var stationLabels = marey.selectAll('text.station-label');
    stationLabels.style('display', function (d) {
      var display = end[d] || titles[d];
      return display ? null : 'none';
    });
    stationLabels.classed('active', function (d) {
      return titles[d.id ? d.id : d];
    });
  }

});