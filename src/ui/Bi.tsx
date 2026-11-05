/** Hindi line with its English gloss underneath. */
export function Bi({ hi, en, className = '' }: { hi: string; en: string; className?: string }) {
  return (
    <span className={`bi ${className}`}>
      <span className="bi__hi" lang="hi">{hi}</span>
      <span className="bi__en" lang="en">{en}</span>
    </span>
  );
}
