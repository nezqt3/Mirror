import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

export interface FieldProps {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, error, className = "", children }: FieldProps): React.JSX.Element {
  return (
    <div className={`ui-field ${className}`.trim()}>
      <label className="ui-field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? <p className="ui-field__error">{error}</p> : hint ? <p className="ui-field__hint">{hint}</p> : null}
    </div>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return <input className={`ui-input ${className}`.trim()} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>): React.JSX.Element {
  return <textarea className={`ui-input ${className}`.trim()} {...props} />;
}

export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>): React.JSX.Element {
  return (
    <select className={`ui-input ${className}`.trim()} {...props}>
      {children}
    </select>
  );
}

export interface AutoFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export function AutoField({ label, hint, error, className, ...props }: AutoFieldProps): React.JSX.Element {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <Input id={id} className={className} aria-invalid={Boolean(error) || undefined} {...props} />
    </Field>
  );
}
