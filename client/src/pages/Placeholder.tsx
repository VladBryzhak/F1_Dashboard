// Temporary stand-in for pages built in later milestones (Calendar, Drivers,
// Teams, Telemetry). Replaced as each milestone lands.
export default function Placeholder({
  title,
  milestone,
}: {
  title: string
  milestone: string
}) {
  return (
    <section>
      <h1>{title}</h1>
      <p className="muted">Coming in {milestone}.</p>
    </section>
  )
}
