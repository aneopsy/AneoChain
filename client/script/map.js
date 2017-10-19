class RobinsonProjection {
    constructor(width) {
        this._width = width;
        this._r = this._width / 5.332539516;
    }

    static _project(lat, lng)
    {
        // 5 degree intervals, so find right indices
        var lI = Math.floor((Math.abs(lat)-RobinsonProjection.EPS)/RobinsonProjection.INTERVAL);
        lI = Math.max(lI, 0);
        var hI = lI + 1;
        var ratio = (Math.abs(lat)-lI*RobinsonProjection.INTERVAL) / RobinsonProjection.INTERVAL;

        // interpolate x and y
        var xDist = RobinsonProjection.X[hI]-RobinsonProjection.X[lI];
        var yDist = RobinsonProjection.Y[hI]-RobinsonProjection.Y[lI];
        var x = ((xDist*ratio)+RobinsonProjection.X[lI]) * (Math.abs(lng) * RobinsonProjection.radians);
        x = lng < 0 ? -x : x;
        var y = (yDist*ratio)+RobinsonProjection.Y[lI];
        y = lat < 0 ? -y : y;

        return {
            x : x,
            y : y
        };
    }

    project(lat, lng) {
        var p = RobinsonProjection._project(lat, lng);
        return {
            x: p.x * this._r,
            y: p.y * this._r
        };
    }
}
RobinsonProjection.X = [
    0.8487, 0.84751182, 0.84479598, 0.840213,
    0.83359314, 0.8257851, 0.814752, 0.80006949,
    0.78216192, 0.76060494, 0.73658673, 0.7086645,
    0.67777182, 0.64475739, 0.60987582, 0.57134484,
    0.52729731, 0.48562614, 0.45167814
];

RobinsonProjection.Y = [
    0, 0.0838426, 0.1676852, 0.2515278, 0.3353704,
    0.419213, 0.5030556, 0.5868982, 0.67182264,
    0.75336633, 0.83518048, 0.91537187, 0.99339958,
    1.06872269, 1.14066505, 1.20841528, 1.27035062,
    1.31998003, 1.3523
];

RobinsonProjection.EPS = 1e-8;
RobinsonProjection.INTERVAL = 5;
RobinsonProjection.pi = Math.PI;
RobinsonProjection.radians = RobinsonProjection.pi / 180;
RobinsonProjection.degrees = 180 / RobinsonProjection.pi;

class HexagonMap {
	constructor(svgElement) {
        this._svg = svgElement;
        // temporarily unhide all the hexagons to get the bounding rects
        svgElement.classList.remove('hide-hexagons');
        var mapDimensions = this.getDimensions(); // also enforces a style update
        this._hexagonDiameter = 0;
        var hexagons = svgElement.querySelectorAll('polygon');
        for (var i = 0; i < hexagons.length; ++i) {
            hexagons[i].cellId = i;
            var boundingBox = hexagons[i].getBoundingClientRect();
            // values relative to map width / height such that they work also when we resize the map
            hexagons[i].centerX = (boundingBox.left + boundingBox.width/2 - mapDimensions.left) / mapDimensions.width;
            hexagons[i].centerY = (boundingBox.top + boundingBox.height/2 - mapDimensions.top) / mapDimensions.height;
            // the hexagons differ very slightly in size, so we take the biggest
            this._hexagonDiameter = Math.max(this._hexagonDiameter, boundingBox.width / mapDimensions.width);
        }
        this._cells = hexagons;
        this._links = [];
        // after we got the hexagon bounding rects, we can hide them again
        svgElement.classList.add('hide-hexagons');
	}

    getDimensions() {
        return this._svg.getBoundingClientRect();
    }

    unhighlightCell(cell) {
        cell.setAttribute('class', '');
        cell.data = null;
    }

    highlightCell(cell, className, data) {
        cell.setAttribute('class', className);

        if (className === 'own-peer') {
            // put my own cell on top of everything else. In svg the stacking is not affected by z-index, but
            // only by document order. So we make the cell the last child
            cell.parentElement.appendChild(cell);
        }

        // XXX another hack
        if (data) {
            cell.data = data;
        }
    }

    _convertCoordinates(latitude, longitude) {
        var mapDimensions = this.getDimensions();
        // the map that we have is cropped out from the full robinson projected map. We have to make
        // the computation on the full/original map, so we calculate the full size.
        var fullMapWidth = 1.0946808510638297 * mapDimensions.width;
        var fullMapHeight = fullMapWidth / 1.97165551906973; // RobinsonProjection maps have a fixed aspect ratio
        var projection = new RobinsonProjection(fullMapWidth, fullMapHeight);
        var point = projection.project(latitude, longitude);
        // the origin is centered in the middle of the map, so we translate it
        // to the top left corner
        point.x = fullMapWidth/2 + point.x;
        point.y = fullMapHeight/2 - point.y;
        // the map that we have is robinson projected and then cropped out and scaled
        point.x = Math.max(0, point.x - 0.07045675413022352*fullMapWidth);
        point.y = Math.max(0, point.y - 0.012380952380952381*fullMapHeight);
        return point;
    }

    _testCoordinateConversion(latitude, longitude) {
        var testDot = window.testDot;
        if (!testDot) {
            testDot = document.createElement('div');
            testDot.style.background = 'red';
            testDot.style.width = '5px';
            testDot.style.height = '5px';
            testDot.style.position = 'absolute';
            document.body.appendChild(testDot);
            window.testDot = testDot;
        }
        var convertedCoordinates = this._convertCoordinates(latitude, longitude);
        console.log(convertedCoordinates);
        testDot.style.left = convertedCoordinates.x-2+'px';
        testDot.style.top = convertedCoordinates.y-2+'px';
    }

    _getClosestCell(x, y) {
        var mapDimensions = this.getDimensions();
        var bestDistance = 0;
        var bestCell = null;
        for (var i = 0; i < this._cells.length; ++i) {
        	// Calculate position from bounding box.
        	var cell = this._cells[i];
            var centerX = cell.centerX * mapDimensions.width;
            var centerY = cell.centerY * mapDimensions.height;
            var xDist = centerX - x;
            var yDist = centerY - y;
            var distance = xDist*xDist + yDist*yDist;

            // Update best cell accordingly.
            if (!bestCell || distance < bestDistance) {
            	bestDistance = distance;
            	bestCell = cell;
			}
        }
        // Return best cell only if its distance in terms of cells is not too far.
        var hexagonDiameter = this._hexagonDiameter * mapDimensions.width;
        return bestDistance > HexagonMap.MAX_CELL_DISTANCE * hexagonDiameter ? null : bestCell;
    }

    getCellByLocation(latitude, longitude) {
        var convertedCoordinates = this._convertCoordinates(latitude, longitude);
        var closestCell = this._getClosestCell(convertedCoordinates.x, convertedCoordinates.y);
		return closestCell;
	}

    addLink(startCell, endCell) {
        if (!startCell || !endCell) {
            return;
        }
        // search whether we already drew that link
        for (var i=0, link; link = this._links[i]; ++i) {
            if (link.start === startCell && link.end === endCell
                || link.end === startCell && link.start === endCell) {
                return;
            }
        }
        // draw the link
        var svgBoundingRect = this.getDimensions();
        var viewBox = this._svg.viewBox;
        var viewBoxWidth = viewBox.baseVal.width;
        var viewBoxHeight = viewBox.baseVal.height;
        var pathEl = document.createElementNS(this._svg.namespaceURI, 'path');
        var path = 'M'+(startCell.centerX*viewBoxWidth)+' '+(startCell.centerY*viewBoxHeight)
            +'L'+(endCell.centerX*viewBoxWidth)+' '+(endCell.centerY*viewBoxHeight);
        pathEl.setAttributeNS(null,'d', path);
        pathEl.classList.add('link');
        this._links.push({
            start: startCell,
            end: endCell,
            path: pathEl
        });
        // insert the path before the startCell such that it will not be drawn over the startCell
        startCell.parentElement.insertBefore(pathEl, startCell);
    }

    removeLink(startCell, endCell) {
        for (var i=0, link; link = this._links[i]; ++i) {
            if (link.start === startCell && link.end === endCell
                || link.end === startCell && link.start === endCell) {
                // we found the link
                startCell.parentElement.removeChild(link.path);
                this._links.splice(i, 1);
                return;
            }
        }
    }
}
HexagonMap.MAX_CELL_DISTANCE = 12; // in terms of cells
