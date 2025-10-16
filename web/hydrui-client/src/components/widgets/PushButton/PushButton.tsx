import "./index.css";

interface PushButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "muted" | undefined;
}

const PushButton: React.FC<PushButtonProps> = ({
  children,
  className,
  onClick,
  disabled,
  variant = "primary",
}: PushButtonProps) => {
  return (
    <button
      className={`push-button ${className ?? ""} ${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default PushButton;
