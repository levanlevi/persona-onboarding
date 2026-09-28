import OpenAI from "openai";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL ?? "gpt-5.5";
export const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2.1";
