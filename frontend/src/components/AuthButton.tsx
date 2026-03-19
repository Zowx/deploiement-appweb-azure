import { useEffect, useState } from 'react';
import { getCurrentUser, loginWithGoogle, logout, UserProfile } from '../api/auth';

export function AuthButton() {
    const [user, setUser] = useState<UserProfile | null | undefined>(undefined);

    useEffect(() => {
        (async () => {
            try {
                const u = await getCurrentUser();
                setUser(u);
            } catch {
                setUser(null);
            }
        })();
    }, []);

    if (user === undefined) return <div style={{ minWidth: 120 }}>...</div>;

    if (!user)
        return (
            <button className='btn btn-primary' onClick={() => loginWithGoogle()}>
                Se connecter avec Google
            </button>
        );

    return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>{user.displayName ?? user.emails?.[0]?.value ?? 'Utilisateur'}</span>
            <button
                className='btn btn-secondary'
                onClick={async () => {
                    await logout();
                    setUser(null);
                    window.location.reload();
                }}
            >
                Déconnexion
            </button>
        </div>
    );
}

export default AuthButton;
