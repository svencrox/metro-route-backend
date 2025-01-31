import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
app.use(cors()); //enable cors support

// middleware
app.use(bodyParser.json()); // parse incoming JSON requests
const port = 8000;

// data structure for metro data
const metroLines: Record<string, string[]> = {
	blue: [
		"East End",
		"Foot Stand",
		"Football Stadium",
		"City Centre",
		"Peter Park",
		"Maximus",
		"Rocky Street",
		"Boxers Street",
		"Boxing Avenue",
		"West End",
	],
	green: [
		"North Park",
		"Sheldon Street",
		"Greenland",
		"City Centre",
		"Stadium House",
		"Green House",
		"Green Cross",
		"South Pole",
		"South Park",
	],
	red: [
		"Matrix Stand",
		"Keymakers Lane",
		"Oracle Lane",
		"Boxing Avenue",
		"Cypher Lane",
		"Smith Lane",
		"Morpheus Lane",
		"Trinity Lane",
		"Neo Lane",
	],
	yellow: [
		"Green Cross",
		"Orange Street",
		"Silk Board",
		"Snake Park",
		"Morpheus Lane",
		"Little Street",
		"Cricket Grounds",
	],
	black: [
		"East End",
		"Gotham Street",
		"Batman Street",
		"Jokers Street",
		"Hawkins Street",
		"Da Vinci Lane",
		"South Park",
		"Newton Bath Tub",
		"Einstein Lane",
		"Neo Lane",
	],
};

// data structure for graph representation
// each station is mapped to its neighboring stations with their respective metro line
type Neighbor = {
	station: string;
	line: string;
};

const graph: Record<string, Neighbor[]> = {};
const allStations = new Set<string>();

// populate graph with connections based on metro lines
Object.entries(metroLines).forEach(([line, stations]) => {
	stations.forEach((station, index) => {
		allStations.add(station); // add station to all stations
		if (!graph[station]) {
			graph[station] = []; // init neighbors list if not already present
		}
		// add neighbors for bidirectional connections
		if (index > 0) {
			graph[station].push({ station: stations[index - 1], line });
		}
		if (index < stations.length - 1) {
			graph[station].push({ station: stations[index + 1], line });
		}
	});
});

// types for dijkstra's function
// PathSegment represents a part of the journey
// RouteResult represents the full journey's details
type PathSegment = {
	station: string;
	line: string;
	direction: string;
};

type RouteResult = {
	path: PathSegment[];
	time: number; // total travel time in minutes
	cost: number; // total cost for station change and line change
};

// dijkstra's algorithm to find the shortest path
const dijkstra = (start: string, end: string): RouteResult | null => {
	const distances: Record<string, number> = {}; // stores shortest distance
	const previous: Record<string, { station: string; line: string } | null> =
		{};
	const visited = new Set<string>();
	const priorityQueue: { station: string; distance: number; line: string }[] =
		[];
	const paths: Record<string, PathSegment[]> = {};

	// Initialize distances and paths
	allStations.forEach((station) => {
		distances[station] = Infinity;
		previous[station] = null;
		paths[station] = [];
	});
	distances[start] = 0;
	priorityQueue.push({ station: start, distance: 0, line: "" });

	while (priorityQueue.length > 0) {
		// Extract station with the smallest distance
		priorityQueue.sort((a, b) => a.distance - b.distance);
		const {
			station: current,
			distance: currentDistance,
			line: currentLine,
		} = priorityQueue.shift()!;

		if (visited.has(current)) continue;
		visited.add(current);

		// If we reached the destination, reconstruct the path
		if (current === end) {
			const path: PathSegment[] = [];
			let station = current;
			while (previous[station]) {
				const { station: prevStation, line: prevLine } =
					previous[station]!;
				const direction =
					metroLines[prevLine][0] === prevStation
						? `towards ${
								metroLines[prevLine][
									metroLines[prevLine].length - 1
								]
						  }`
						: `towards ${metroLines[prevLine][0]}`;
				path.unshift({ station, line: prevLine, direction });
				station = prevStation;
			}
			path.unshift({
				station: start,
				line: path[0]?.line || "",
				direction: path[0]?.direction || "",
			});

			// Calculate total time and cost
			const time = (path.length - 1) * 5;
			const cost =
				path.length -
				1 +
				path.filter(
					(_, i) => i > 0 && path[i].line !== path[i - 1].line
				).length;

			return { path, time, cost };
		}

		// Explore neighbors
		for (const { station: neighbor, line } of graph[current]) {
			const isLineChange = currentLine && line !== currentLine ? 1 : 0;
			const newDistance = currentDistance + 1 + isLineChange; // 1 for station hop, +1 for line change

			if (newDistance < distances[neighbor]) {
				distances[neighbor] = newDistance;
				previous[neighbor] = { station: current, line };
				priorityQueue.push({
					station: neighbor,
					distance: newDistance,
					line,
				});
			}
		}
	}

	// If we reach here, no path was found
	return null;
};

// API endpoint
app.post("/calculate-route", (req: Request, res: Response) => {
	const { start, end } = req.body as { start: string; end: string };

	// validate input parameters
	if (!start || !end) {
		return res
			.status(400)
			.json({ error: "Start and end stations are required" });
	}

	// validate if stations exist
	if (!allStations.has(start) || !allStations.has(end)) {
		return res.status(400).json({ error: "Invalid start or end station" });
	}

	// for same station case
	if (start === end) {
		return res.json({
			path: [start],
			time: 0,
			cost: 0,
			message: "You are already at your destination!",
		});
	}

	const result = dijkstra(start, end);

	if (result) {
		return res.json(result);
	} else {
		return res.status(404).json({ error: "Route not found" });
	}
});

app.get("/stations", (req: Request, res: Response) => {
	const allStations: string[] = [];

	// extract from metro lines
	Object.values(metroLines).forEach((lineStations) => {
		lineStations.forEach((station) => {
			if (!allStations.includes(station)) {
				allStations.push(station);
			}
		});
	});

	res.json(allStations);
});

app.listen(port, () => {
	console.log(`Server running on http://localhost:${port}`);
});
