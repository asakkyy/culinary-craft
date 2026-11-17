export default function Avatar({ user, className = 'user-avatar small' }) {
  return (
    <span className={className}>
      {user?.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={`Аватар: ${user.name}`}
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
        />
      ) : (
        user?.initials ||
        user?.name
          ?.split(' ')
          .slice(0, 2)
          .map((part) => part[0])
          .join('') ||
        '◯'
      )}
    </span>
  );
}
