'use client';
import { useState, forwardRef, InputHTMLAttributes } from 'react';

// Input de contraseña con botón 👁 para mostrar/ocultar. Drop-in replacement
// de <input type="password" />. Acepta cualquier prop de input estándar.
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  containerClassName?: string;
};

const PasswordInput = forwardRef<HTMLInputElement, Props>(
  function PasswordInput({ className, containerClassName, ...rest }, ref) {
    const [show, setShow] = useState(false);
    return (
      <div className={`relative ${containerClassName ?? ''}`}>
        <input
          ref={ref}
          type={show ? 'text' : 'password'}
          className={`${className ?? 'input'} pr-11`}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-white/60 hover:text-white active:scale-90 rounded"
        >
          {show ? (
            // Ojo tachado
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.6 19.6 0 0 1 4.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.4 19.4 0 0 1-2.16 3.19M1 1l22 22M14.12 14.12A3 3 0 1 1 9.88 9.88" />
            </svg>
          ) : (
            // Ojo abierto
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    );
  }
);

export default PasswordInput;
