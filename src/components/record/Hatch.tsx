/** The 45° hatch for machine-off cards (Sunday, power cut). */
export function Hatch({ id = 'hatch' }: { id?: string }) {
  return (
    <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="4" height="4" fill="#E9ECE4" />
      <path d="M0 0v4" stroke="#9BA19A" strokeWidth="1.1" />
    </pattern>
  );
}
