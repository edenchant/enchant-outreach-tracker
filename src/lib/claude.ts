import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { BrandHistoryEntry, Contact } from "./types";

const PROMPT_DATA_DIR = path.join(process.cwd(), "src", "lib", "prompt-data");

const ED_INSTRUCTIONS = `You are a specialized assistant who helps users craft persuasive, friendly sales messages and emails, for Ed, head of Business Development at Enchant Group — a group of music and sound creative agencies including Sonicbrand, Resister and WMP.

Your primary goal is to maintain the user's unique tone-of-voice, which you learn from examples they provide or from their instructions. When the user shares samples of their writing, you analyze them for style, word choice, and cadence, and mirror that style in your drafts. The goal of each email, unless otherwise stated, is to organise a meeting.

Use the structure, tone and style demonstrated in the reference document "Email Tone & Examples" below: friendly, approachable, professional, warm, gently persuasive, and structured. Always end every email draft with the sign-off: 'Kind regards,' without exception. The main body of the email must be no more than two short paragraphs, without exception. No em dashes, without exception.

Occasionally you will be asked to draft a LinkedIn Connect Message; these must be maximum 300 characters.

Reference and suggest any relevant services from the "Our Services" reference document below where appropriate, tailoring recommendations to the brand's likely needs.

When given background information on a brand (see "Brand Histories" below), incorporate it into your recommendations and emails, referencing any prior work, relevant contacts, or recent conversations as appropriate to personalize outreach.

When given a relevant job title (see "Buyer Persona Information" below), use it to tailor tone and content of outreach based on job role — for example, using more pragmatic, budget-conscious language for procurement or more visionary language for brand leadership. Also reflect the appropriate tone preference: slightly less formal for brand, creative, strategy, and business development roles, and slightly more formal for marketing, procurement, and account management roles.

When a creative agency is referenced, incorporate detail from the "Agency History" reference document below to inform the context of the relationship, past projects, or mutual connections.

When asked for an email draft, reply with only the draft email, no further information or justification is needed.`;

const REFERENCE_FILES: Array<{ heading: string; file: string }> = [
  { heading: "Email Tone & Examples", file: "email-tone-examples.txt" },
  { heading: "Our Services", file: "our-services.txt" },
  { heading: "Buyer Persona Information", file: "buyer-personas.txt" },
  { heading: "Brand Histories", file: "brand-histories.txt" },
  { heading: "Agency History", file: "agency-history.txt" },
];

let cachedSystemPrompt: string | null = null;

function buildSystemPrompt(): string {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const sections = REFERENCE_FILES.map(({ heading, file }) => {
    const text = fs.readFileSync(path.join(PROMPT_DATA_DIR, file), "utf-8").trim();
    return `## ${heading}\n\n${text}`;
  });
  cachedSystemPrompt = `${ED_INSTRUCTIONS}\n\n${sections.join("\n\n")}`;
  return cachedSystemPrompt;
}

export type DraftKind = "email" | "linkedin";

export interface DraftRequest {
  contact: Contact;
  kind: DraftKind;
  extraContext?: string;
  brandHistory?: BrandHistoryEntry | null;
}

function contactBrief(contact: Contact, brandHistory?: BrandHistoryEntry | null): string {
  const parts: string[] = [];
  parts.push(`Name: ${contact.name}`);
  parts.push(`Role: ${contact.role ?? "unknown"}`);
  parts.push(`Brand: ${contact.brand ?? "unknown"}${contact.subBrand ? ` (${contact.subBrand})` : ""}`);
  parts.push(`Tier: ${contact.tier?.label ?? "unassigned"}`);
  parts.push(`Outreach stage: ${contact.stage?.name ?? "not yet started"}`);
  parts.push(`Followers: ${contact.followers ?? "unknown"}`);
  if (contact.lastContactedAt) parts.push(`Last contacted: ${new Date(contact.lastContactedAt).toLocaleDateString("en-GB")}`);
  if (contact.promptContext) parts.push(`Notes from the outreach tracker: ${contact.promptContext}`);
  if (brandHistory) {
    parts.push(
      `Most recent Brand Histories entry for this brand: ${brandHistory.eventType} on ${new Date(brandHistory.date).toLocaleDateString("en-GB")}${brandHistory.note ? ` — ${brandHistory.note}` : ""}. Reference this where it naturally fits.`
    );
  }
  return parts.join("\n");
}

export async function draftMessage({ contact, kind, extraContext, brandHistory }: DraftRequest): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured on this deployment.");
  }

  const client = new Anthropic({ apiKey });

  const instructionLine =
    kind === "linkedin"
      ? "Draft a LinkedIn connection request message (maximum 300 characters) to this contact."
      : "Draft an outreach email to this contact, aimed at organising a meeting.";

  const contextBlock = extraContext?.trim()
    ? `\n\nAdditional context provided by Ed for this specific draft — make sure it's reflected in the message: ${extraContext.trim()}`
    : "";

  const userMessage = `${instructionLine}

${contactBrief(contact, brandHistory)}${contextBlock}

This is a one-shot, unattended request — if you would normally ask a clarifying question first, make the most reasonable assumption instead and produce the draft directly. Reply with only the draft itself, no preamble or explanation.`;

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: buildSystemPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Claude returned an empty response.");
  }

  return text;
}
