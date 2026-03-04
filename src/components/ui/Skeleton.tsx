import './Skeleton.css'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  className?: string
}

export function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = '4px',
  className = '',
}: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
      }}
    />
  )
}

export function ConversationSkeleton() {
  return (
    <div className="conversation-skeleton">
      <Skeleton width={16} height={16} borderRadius="50%" />
      <Skeleton width="70%" height={14} />
    </div>
  )
}

export function MessageSkeleton() {
  return (
    <div className="message-skeleton">
      <Skeleton width={28} height={28} borderRadius="50%" />
      <div className="message-skeleton-content">
        <Skeleton width="80%" height={14} />
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={14} />
      </div>
    </div>
  )
}
