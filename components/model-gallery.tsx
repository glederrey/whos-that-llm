"use client";

import { useState } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { Twemoji } from "@/components/twemoji";
import { filterPublicModels, groupByCompany, type PublicModel } from "@/lib/model-list";

export function ModelGallery({ models }: { models: PublicModel[] }) {
  const [query, setQuery] = useState("");
  const shown = filterPublicModels(models, query);
  const groups = groupByCompany(shown);
  return (
    <div className="stack">
      <div className="model-toolbar">
        <input
          type="search"
          className="model-search"
          value={query}
          maxLength={100}
          placeholder="Search a model, a company, a year"
          aria-label="Search models"
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className="muted model-count" aria-live="polite">
          {shown.length === models.length ? `${models.length} models` : `${shown.length} of ${models.length} models`}
        </p>
      </div>
      {groups.length === 0 ? <p className="muted">No model matches that search.</p> : null}
      {groups.map((group) => (
        <section key={group.companyId} className="model-group">
          <h2 className="model-company">
            <span className="model-logo">
              <CompanyLogo src={group.logoUrl} />
            </span>
            {group.companyName}
            <span className="muted model-company-count">{group.models.length}</span>
          </h2>
          <ul className="model-grid">
            {group.models.map((model) => (
              <li key={model.id} className="card model-card">
                <p className="model-name">{model.name}</p>
                <p className="model-facts muted">
                  <span className="model-fact">
                    <Twemoji emoji={model.originFlag} />
                    {model.originName}
                  </span>
                  <span className="model-fact">{model.year}</span>
                  <span className="model-fact">{model.sizeName}</span>
                </p>
                <a className="model-link" href={model.openRouterUrl} target="_blank" rel="noopener noreferrer">
                  View on OpenRouter
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M9 7h8v8" />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
