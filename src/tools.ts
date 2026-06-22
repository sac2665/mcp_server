import { Env, Workout, Instructor } from "./types";
import {
  getPopularClasses,
  searchClasses,
  getClass,
  listInstructors,
} from "./apex-api";

export const TOOL_DEFINITIONS = [
  {
    name: "popular_classes",
    description:
      "Get the top 10 popular workouts by session count started in the given date range. Returns titles only (no IDs). Counts sessions started in the range with no completion filter.",
    inputSchema: {
      type: "object" as const,
      properties: {
        from: {
          type: "string",
          description: "Start date in YYYY-MM-DD format",
        },
        to: {
          type: "string",
          description: "End date in YYYY-MM-DD format",
        },
        type: {
          type: "string",
          enum: ["WorkoutOnDemand", "WorkoutLive"],
          description: "Optional filter by workout type",
        },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "search_classes",
    description:
      "Search for workouts/classes with various filters. Returns paginated results.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Filter by text in title (case-insensitive)",
        },
        activity: {
          type: "integer",
          enum: [0, 1, 2],
          description: "0=Cycle, 1=Strength, 2=Mobility",
        },
        weights: {
          type: "boolean",
        },
        time: {
          type: "array",
          items: {
            type: "string",
            enum: ["<1050", "1050-1500", "1501-2250", "2251-3150", ">3150"],
          },
        },
        instructors: {
          type: "string",
          description: "Comma-separated instructor IDs",
        },
        genres: {
          type: "string",
          description: "Comma-separated genre IDs",
        },
        music: {
          type: "string",
          description: "Comma-separated music IDs",
        },
        levels: {
          type: "string",
          description: "Comma-separated level numbers (1-4)",
        },
        per_page: {
          type: "integer",
          default: 50,
        },
        page: {
          type: "integer",
          default: 1,
        },
      },
    },
  },
  {
    name: "get_class",
    description: "Get detailed information about a specific on-demand class.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: {
          type: "integer",
          description: "Workout ID",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "list_instructors",
    description:
      "List all instructors including archived ones. Use isArchived to filter.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  env: Env
): Promise<{ content: Array<{ type: string; text: string }> }> {
  switch (name) {
    case "popular_classes": {
      const { from, to, type } = args as {
        from: string;
        to: string;
        type?: string;
      };
      const result = await getPopularClasses(env, from, to, type);
      const data = result.data.map(Number);
      const zipped = result.labels.map((title, i) => ({
        title,
        count: data[i] ?? 0,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(zipped, null, 2) }],
      };
    }

    case "search_classes": {
      const params: Record<string, string | number | boolean | string[]> = {};
      if (args.name) params.name = String(args.name);
      if (args.activity !== undefined) params.activity = Number(args.activity);
      if (args.weights !== undefined) params.weights = Boolean(args.weights);
      if (args.time) params.time = args.time as string[];
      if (args.instructors) params.instructors = String(args.instructors);
      if (args.genres) params.genres = String(args.genres);
      if (args.music) params.music = String(args.music);
      if (args.levels) params.levels = String(args.levels);
      params.per_page = (args.per_page as number) || 50;
      params.page = (args.page as number) || 1;

      const result = await searchClasses(env, params);
      const cleaned = result.workouts.map(cleanWorkout);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { total: result.total, workouts: cleaned },
              null,
              2
            ),
          },
        ],
      };
    }

    case "get_class": {
      const { id } = args as { id: number };
      const result = await getClass(env, id);
      const cleaned = cleanWorkout(result);
      return {
        content: [{ type: "text", text: JSON.stringify(cleaned, null, 2) }],
      };
    }

    case "list_instructors": {
      const result = await listInstructors(env);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function cleanWorkout(w: Workout): Omit<Workout, "isLiked" | "splits"> {
  const { videoUrl, ...rest } = w;
  return {
    ...rest,
    videoUrl,
  };
}
