/**
 * The Beacon Travel confirmation (see CONTEXT.md "Beacon"/"Travel", ADR-0023).
 * Tapping a Beacon opens this; confirming triggers the client-orchestrated Level
 * swap (snapshot Player -> fade -> reconnect to the destination Level).
 */
export function TravelPrompt({
  destinationName,
  onConfirm,
  onCancel,
}: {
  destinationName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="name-overlay" onClick={onCancel}>
      <div className="name-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="name-title">{`Travel to ${destinationName}?`}</h2>
        <div className="travel-actions">
          <button className="name-confirm" autoFocus onClick={onConfirm}>
            Travel
          </button>
          <button className="travel-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
