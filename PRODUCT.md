# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Anyone curious about AI, casual players first. They sign up, chat with a hidden model and try to tell which one it is. A second audience is AI enthusiasts and developers who already know the model names and want to test how well they recognise each model's style. Phone and desktop are equally important.

## Product Purpose

A chat game. A hidden model answers; the player has ten messages to work out which model it is. They can name it after a reply, send the next message without guessing, or give up. Success is a player who finishes rounds, comes back for the daily round, and shares a result.

## Positioning

The player recognises a model by how it talks, in a live chat, not by benchmark numbers. A leaderboard or arena ranks models; this game scores the player.

## Operating Context

One Next.js site. Players must sign up or log in (Google or email and password) before they play; the main page is public. Rounds stream word by word. Modes: Daily, All models, Company, Category, Origin, Custom. The home page shows the weekly top 5; the profile page shows a player's history; result cards can be shared. Game rules live in `docs/`.

## Capabilities and Constraints

- Ten messages per round, at most 500 characters each. Twenty games per rolling hour.
- Hints (year, size) can be bought; there is a no-hint mode with a score multiplier.
- The hidden model id never reaches the browser during an active round.
- The roster is about 145 models from 11 companies, managed by the owner in `/admin/models`.
- Every model call costs real money (OpenRouter). A credit error pauses the game for everyone.
- Admin pages are visible only to the owner.

## Brand Commitments

The name "Who's that LLM?" and the current logo assets stay as they are.

## Evidence on Hand

Company logos and the site logo are in the repo and the Supabase `logos` bucket. There are no testimonials, press, or user numbers on hand; none may be invented.

## Product Principles

- Guessing by conversation is the game; keep the chat at the centre of every screen.
- A casual player must understand a round without knowing any model name; depth is for those who want it.
- Show the limits honestly (messages left, games per hour, paused game).
- Phone and desktop get the same game, not a reduced one.
- The game never reveals the hidden model before the round ends.

## Accessibility & Inclusion

Target WCAG AA contrast, and the whole game must be playable with a keyboard only.
