# A sustained environmental breach is one alert episode per Location, driven by observation time

Readings from registered probes (ADR 0003) and audited staff spot checks go through one function, `acceptReading` (`packages/backend/convex/utils/alertEpisodes.ts`), in the same transaction that stores them. It judges the reading against the Location's current thresholds and applies it to the Location's alert episode. A Location has at most one open episode. A reading never creates an alert of its own any more; the episode and the readings linked to it are the evidence.

Order follows the time a reading was observed, not when it arrived. A probe's reading observed before the latest reading already accepted from that probe is late: it is stored and marked, and when it was observed during the open episode it counts as that episode's evidence (counts, extremes, breached measures), but it never opens, escalates or recovers an episode. A late breach observed before the episode began, or while none was open, stays on the reading only. Staff readings carry the time they were recorded, so they are never late. A retried reading with the same identity is acknowledged without being stored or counted again (ADR 0003).

Transitions, all from current readings:

- **Open**: a reading outside the thresholds when no episode is open. The episode keeps the thresholds in force at that moment.
- **Update**: every later reading updates the counts, the lowest and highest value of each measure and the breached measures. Updates notify nobody.
- **Escalate**: a reading still outside the thresholds observed at least one hour after the episode began reaches level 1, and one observed at least 24 hours after reaches level 2. A breach reported again after a long gap goes straight to the level it reached; that level is notified once.
- **Recover**: every source that went out of range during the episode must show it is back. A probe recovers after in-range readings spanning 30 minutes from its first in-range reading; any reading outside the thresholds restarts that. A staff reading within the thresholds is a deliberate spot check and ends the breach staff readings showed at once, but it cannot recover a breach a probe showed, and readings from a probe that stayed in range cannot recover a probe that went quiet.
- **Resolve**: a location manager closes an open episode with a required note when readings cannot show recovery, for example after its probe was moved or retired, or its location was removed. A later breach opens a new episode.

Silence is not health. A probe is silent when no reading observed in the last two hours has arrived from it, counting from its binding until its first reading. Silence never recovers or escalates an episode; an open episode whose probes went quiet stays open and says so. The location view computes silence from a time the caller passes, and a Location is in range only when every bound probe of an active device reports within its thresholds. A device's last request (which may have failed) is shown apart from each probe's last reading.

Each transition dispatches one `environmental_alert` (category Alerts) through `dispatchNotification` (ADR 0007) with the idempotency key `alert-episode:{episode}:opened`, `:escalated:{level}` or `:recovered`, naming the episode (`alertEpisode`, read permission `locations.read`). Candidates are members whose role may update locations; the dispatcher then keeps current members who may read locations and applies each one's category, email and digest choices (ADR 0008). Alerts follow the recipient's chosen cadence like every other category, so a digest recipient sees an escalation in the app at once and by email at their digest time. The `emailNotification` and `inAppNotification` switches on conservation alert rules do not apply: channels are the recipient's choice, and environmental rules had no recipients or interface.

New thresholds apply to later readings. Staff with location administration set temperature and relative humidity limits; light and UV limits from earlier data are kept and still judged.

Considered and rejected:

- One episode per probe, because two probes in one room would raise two alerts for one breach.
- Recovery on the first in-range reading, because a value hovering at its limit would open and close episodes and notify on each.
- Treating any reading at the location as recovery evidence, because a probe that stayed in range, or a probe that went silent, says nothing about the one that showed the breach.
- Notifying when a probe goes silent, because it needs scheduled work over all probes; silence is shown wherever readings are, and listed as a follow-up.
- Configurable timings per location or device; the fixed one hour, one day, 30 minutes and two hours are explicit and shown to staff, and can become settings when an institution needs them.
