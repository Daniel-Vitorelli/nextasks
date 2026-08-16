/**
 * Helpers de fuso horário do navegador.
 */

/** Abreviação do fuso do navegador (ex.: "BRT") com fallback GMT±h. */
export function getTimezoneAbbreviation(): string {
  const date = new Date();
  const timeZoneString = date.toLocaleTimeString("en-US", {
    timeZoneName: "short",
  });
  const match = timeZoneString.match(/\s([A-Z]{2,5})$/);

  if (match) {
    return match[1];
  }

  // Fallback para o formato de offset.
  const offset = -date.getTimezoneOffset();
  const hours = Math.floor(Math.abs(offset) / 60);
  const sign = offset >= 0 ? "+" : "-";
  return `GMT${sign}${hours}`;
}