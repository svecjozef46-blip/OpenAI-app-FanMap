import { AdminForm, Field, inputClass } from "@/components/admin/AdminForm";
import { saveLeague, saveMatch, saveTeam } from "@/app/admin/(panel)/actions";
import { isoToUtcInput } from "@/lib/admin/form";
import type { League, Match, Team } from "@/lib/types";

// One form per entity, each used by both its "new" page (no existing
// record) and its edit page. Server Components: they only render inputs
// with default values; the interactive part (pending state, error message)
// lives in AdminForm.

const SPORT_OPTIONS = [
  { value: "football", label: "Football (soccer)" },
  { value: "american_football", label: "American football" },
  { value: "basketball", label: "Basketball" },
  { value: "baseball", label: "Baseball" },
  { value: "ice_hockey", label: "Ice hockey" },
];

function ActiveCheckbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-300">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4" />
      {label}
    </label>
  );
}

export function LeagueForm({ league }: { league?: League }) {
  return (
    <AdminForm action={saveLeague.bind(null, league?.id ?? null)} submitLabel={league ? "Save league" : "Create league"}>
      <Field label="Name">
        <input name="name" required defaultValue={league?.name} className={inputClass} />
      </Field>
      <Field label="Slug" hint="Used in URLs. Leave empty to generate it from the name.">
        <input name="slug" defaultValue={league?.slug} className={inputClass} />
      </Field>
      <Field label="Sport">
        <select name="sport" required defaultValue={league?.sport ?? "football"} className={inputClass}>
          {SPORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <ActiveCheckbox
        name="is_active"
        label="Active (visible on the public site)"
        defaultChecked={league?.is_active ?? true}
      />
    </AdminForm>
  );
}

export function TeamForm({ team, leagues }: { team?: Team; leagues: League[] }) {
  return (
    <AdminForm action={saveTeam.bind(null, team?.id ?? null)} submitLabel={team ? "Save team" : "Create team"}>
      <Field label="League">
        <select name="league_id" required defaultValue={team?.league_id ?? ""} className={inputClass}>
          <option value="" disabled>
            Choose a league…
          </option>
          {leagues.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
              {l.is_active ? "" : " (inactive)"}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Name">
        <input name="name" required defaultValue={team?.name} className={inputClass} />
      </Field>
      <Field label="Short name" hint="2–4 letters shown on badges, e.g. LIV.">
        <input name="short_name" required maxLength={4} defaultValue={team?.short_name} className={inputClass} />
      </Field>
      <div className="flex gap-6">
        <Field label="Primary color" hint="Map + badge color.">
          <input
            name="primary_color"
            type="color"
            defaultValue={team?.primary_color ?? "#C8102E"}
            className="h-10 w-20 cursor-pointer rounded-md border border-white/10 bg-zinc-900"
          />
        </Field>
        <Field label="Secondary color" hint="Badge border.">
          <input
            name="secondary_color"
            type="color"
            defaultValue={team?.secondary_color ?? "#FFFFFF"}
            className="h-10 w-20 cursor-pointer rounded-md border border-white/10 bg-zinc-900"
          />
        </Field>
      </div>
      <p className="text-xs text-zinc-500">
        No club logos on purpose — official crests need a license (see docs/idea.md). The site shows the short name
        on the team colors instead.
      </p>
      <ActiveCheckbox
        name="is_active"
        label="Active (visible on the public site)"
        defaultChecked={team?.is_active ?? true}
      />
    </AdminForm>
  );
}

export function MatchForm({ match, leagues, teams }: { match?: Match; leagues: League[]; teams: Team[] }) {
  const leagueName = new Map(leagues.map((l) => [l.id, l.name]));
  // Teams are listed from every league (grouped by league), not filtered
  // by the match's league: competitions like the Champions League have
  // teams that belong to their domestic league.
  const teamOptions = [...teams]
    .sort((a, b) => (leagueName.get(a.league_id) ?? "").localeCompare(leagueName.get(b.league_id) ?? "") || a.name.localeCompare(b.name))
    .map((t) => (
      <option key={t.id} value={t.id}>
        {t.name} — {leagueName.get(t.league_id) ?? "?"}
        {t.is_active ? "" : " (inactive)"}
      </option>
    ));

  return (
    <AdminForm action={saveMatch.bind(null, match?.id ?? null)} submitLabel={match ? "Save match" : "Create match"}>
      <Field label="League / competition">
        <select name="league_id" required defaultValue={match?.league_id ?? ""} className={inputClass}>
          <option value="" disabled>
            Choose a league…
          </option>
          {leagues.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
              {l.is_active ? "" : " (inactive)"}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Home team">
        <select name="home_team_id" required defaultValue={match?.home_team_id ?? ""} className={inputClass}>
          <option value="" disabled>
            Choose a team…
          </option>
          {teamOptions}
        </select>
      </Field>
      <Field label="Away team">
        <select name="away_team_id" required defaultValue={match?.away_team_id ?? ""} className={inputClass}>
          <option value="" disabled>
            Choose a team…
          </option>
          {teamOptions}
        </select>
      </Field>
      <Field
        label="Kickoff (UTC)"
        hint="Enter UTC time. Slovakia is UTC+1 in winter and UTC+2 in summer — e.g. 21:00 Bratislava summer time = 19:00 UTC."
      >
        <input
          name="kickoff_at"
          type="datetime-local"
          required
          defaultValue={match ? isoToUtcInput(match.kickoff_at) : undefined}
          className={inputClass}
        />
      </Field>
      <Field label="Status" hint="Archived = hidden from the public and closed for voting. Votes are kept.">
        <select name="status" required defaultValue={match?.status ?? "upcoming"} className={inputClass}>
          <option value="upcoming">Upcoming</option>
          <option value="live">Live</option>
          <option value="finished">Finished</option>
          <option value="archived">Archived</option>
        </select>
      </Field>
      <ActiveCheckbox
        name="is_featured"
        label="Featured (shown in the rotating map on the home page — pick a few big matches)"
        defaultChecked={match?.is_featured ?? false}
      />
    </AdminForm>
  );
}
