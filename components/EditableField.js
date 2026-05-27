'use client';

/**
 * EditableField
 *
 * Inline editor overlay component used exclusively in admin editor mode.
 * Renders as plain text in "public" mode (or when onEdit is not provided).
 * In editor mode wraps the value in a styled input/textarea that looks
 * native inside the existing FRH components.
 *
 * Props:
 *   value      {string|number}  Current value to display / edit
 *   onEdit     {function}       Called with new value on change. Presence of
 *                               this prop is what switches to editor mode.
 *   multiline  {boolean}        Use <textarea> instead of <input>
 *   className  {string}         Extra classes forwarded to the control
 *   placeholder {string}        Placeholder text shown when empty
 *   type       {string}         Input type (default "text"); ignored for multiline
 *   min/max    {number}         Numeric bounds (for type="number")
 *   style      {object}         Extra inline styles forwarded to the control
 */
export default function EditableField({
  value,
  onEdit,
  multiline = false,
  className = '',
  placeholder = '',
  type = 'text',
  min,
  max,
  style = {},
}) {
  // ── Read-only (public mode) ───────────────────────────────────────────────
  if (!onEdit) {
    return <>{value}</>;
  }

  // ── Editor mode ───────────────────────────────────────────────────────────
  const baseStyle = {
    background: 'rgba(255,212,0,0.07)',
    border: '1px dashed rgba(255,212,0,0.45)',
    borderRadius: 2,
    color: 'inherit',
    font: 'inherit',
    fontSize: 'inherit',
    lineHeight: 'inherit',
    letterSpacing: 'inherit',
    fontFamily: 'inherit',
    fontWeight: 'inherit',
    textTransform: 'inherit',
    padding: '0 3px',
    margin: 0,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    resize: multiline ? 'vertical' : 'none',
    ...style,
  };

  if (multiline) {
    return (
      <textarea
        value={value ?? ''}
        onChange={(e) => onEdit(e.target.value)}
        placeholder={placeholder}
        className={`frh-editable-field ${className}`}
        style={{ ...baseStyle, minHeight: 56 }}
        rows={2}
      />
    );
  }

  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onEdit(type === 'number' ? Number(e.target.value) : e.target.value)}
      placeholder={placeholder}
      className={`frh-editable-field ${className}`}
      style={baseStyle}
      min={min}
      max={max}
    />
  );
}
