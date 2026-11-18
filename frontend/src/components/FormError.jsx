import { useEffect, useRef } from 'react';
export default function FormError({ children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
  }, [children]);
  return (
    <div ref={ref} role="alert" tabIndex={-1} className="error-box">
      {children}
    </div>
  );
}
