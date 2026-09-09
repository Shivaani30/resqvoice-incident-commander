export function ThemeToggleBar({ theme, onChange }: {
    theme: string;
    onChange: (theme: string) => void;
}) {
    return <div className="theme-toggle" role="group" aria-label="Color theme">{['light', 'dark'].map(value => <button key={value} aria-pressed={theme === value} className={theme === value ? 'active' : ''} onClick={() => onChange(value)}>{value === 'light' ? 'Light' : 'Dark'}{theme === value && <span aria-hidden="true"> &#10003;</span>}</button>)}</div>;
}
