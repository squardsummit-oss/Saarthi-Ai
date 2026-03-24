'use client';

import { motion, AnimatePresence } from 'framer-motion';

type MonkeyMode = 'idle' | 'username' | 'password' | 'success';

interface MonkeyMascotProps {
  mode: MonkeyMode;
  eyeOffsetX?: number; // -1 to 1, for tracking cursor in username field
  isAdmin?: boolean;
}

export default function MonkeyMascot({ mode, eyeOffsetX = 0, isAdmin = false }: MonkeyMascotProps) {
  // Clamp eye offset
  const clampedX = Math.max(-1, Math.min(1, eyeOffsetX));
  const eyeX = clampedX * 6;
  const eyeY = mode === 'username' ? 2 : 0;

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
      <motion.svg
        width={isAdmin ? 160 : 200}
        height={isAdmin ? 160 : 200}
        viewBox="0 0 200 200"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >
        {/* ── BODY ── */}
        <motion.ellipse
          cx="100" cy="175" rx="45" ry="25"
          fill="#5D3A1A"
        />

        {/* ── HEAD (main face circle) ── */}
        <motion.circle
          cx="100" cy="95" r="55"
          fill="#8B5E3C"
          stroke="#6B4226"
          strokeWidth="2"
        />

        {/* ── INNER FACE (lighter area) ── */}
        <motion.ellipse
          cx="100" cy="105" rx="38" ry="35"
          fill="#D4A574"
        />

        {/* ── LEFT EAR ── */}
        <circle cx="48" cy="80" r="18" fill="#8B5E3C" stroke="#6B4226" strokeWidth="2" />
        <circle cx="48" cy="80" r="10" fill="#D4A574" />

        {/* ── RIGHT EAR ── */}
        <circle cx="152" cy="80" r="18" fill="#8B5E3C" stroke="#6B4226" strokeWidth="2" />
        <circle cx="152" cy="80" r="10" fill="#D4A574" />

        {/* ── EYES ── */}
        <AnimatePresence mode="wait">
          {mode === 'password' ? (
            /* ── PASSWORD MODE: Covering eyes with hands ── */
            <motion.g
              key="hands-covering"
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              {/* Left hand covering left eye */}
              <motion.ellipse
                cx="80" cy="90" rx="22" ry="16"
                fill="#8B5E3C"
                stroke="#6B4226"
                strokeWidth="1.5"
              />
              {/* Fingers on left hand */}
              <motion.ellipse cx="66" cy="86" rx="7" ry="5" fill="#8B5E3C" stroke="#6B4226" strokeWidth="1" />
              <motion.ellipse cx="68" cy="94" rx="7" ry="5" fill="#8B5E3C" stroke="#6B4226" strokeWidth="1" />
              <motion.ellipse cx="72" cy="100" rx="6" ry="4.5" fill="#8B5E3C" stroke="#6B4226" strokeWidth="1" />

              {/* Right hand covering right eye */}
              <motion.ellipse
                cx="120" cy="90" rx="22" ry="16"
                fill="#8B5E3C"
                stroke="#6B4226"
                strokeWidth="1.5"
              />
              {/* Fingers on right hand */}
              <motion.ellipse cx="134" cy="86" rx="7" ry="5" fill="#8B5E3C" stroke="#6B4226" strokeWidth="1" />
              <motion.ellipse cx="132" cy="94" rx="7" ry="5" fill="#8B5E3C" stroke="#6B4226" strokeWidth="1" />
              <motion.ellipse cx="128" cy="100" rx="6" ry="4.5" fill="#8B5E3C" stroke="#6B4226" strokeWidth="1" />
            </motion.g>
          ) : (
            /* ── NORMAL EYES (idle / username / success) ── */
            <motion.g
              key="eyes-visible"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Left eye white */}
              <ellipse cx="82" cy="88" rx="13" ry="14" fill="white" />
              {/* Left pupil */}
              <motion.circle
                cx="82"
                cy="88"
                r="6"
                fill="#2C1810"
                animate={{
                  cx: 82 + eyeX,
                  cy: 88 + eyeY,
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
              {/* Left eye shine */}
              <motion.circle
                cx="85" cy="85" r="2.5" fill="white" opacity={0.8}
                animate={{
                  cx: 85 + eyeX * 0.5,
                  cy: 85 + eyeY * 0.5,
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />

              {/* Right eye white */}
              <ellipse cx="118" cy="88" rx="13" ry="14" fill="white" />
              {/* Right pupil */}
              <motion.circle
                cx="118"
                cy="88"
                r="6"
                fill="#2C1810"
                animate={{
                  cx: 118 + eyeX,
                  cy: 88 + eyeY,
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
              {/* Right eye shine */}
              <motion.circle
                cx="121" cy="85" r="2.5" fill="white" opacity={0.8}
                animate={{
                  cx: 121 + eyeX * 0.5,
                  cy: 85 + eyeY * 0.5,
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />

              {/* Eyebrows */}
              <motion.path
                d="M70 76 Q82 70 94 76"
                fill="none"
                stroke="#5D3A1A"
                strokeWidth="2.5"
                strokeLinecap="round"
                animate={{
                  d: mode === 'success'
                    ? 'M70 72 Q82 66 94 72'
                    : 'M70 76 Q82 70 94 76',
                }}
                transition={{ duration: 0.3 }}
              />
              <motion.path
                d="M106 76 Q118 70 130 76"
                fill="none"
                stroke="#5D3A1A"
                strokeWidth="2.5"
                strokeLinecap="round"
                animate={{
                  d: mode === 'success'
                    ? 'M106 72 Q118 66 130 72'
                    : 'M106 76 Q118 70 130 76',
                }}
                transition={{ duration: 0.3 }}
              />
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── NOSE ── */}
        <ellipse cx="100" cy="105" rx="5" ry="3.5" fill="#5D3A1A" />

        {/* ── MOUTH ── */}
        <motion.path
          d="M88 115 Q100 125 112 115"
          fill="none"
          stroke="#5D3A1A"
          strokeWidth="2.5"
          strokeLinecap="round"
          animate={{
            d: mode === 'success'
              ? 'M85 113 Q100 132 115 113'
              : mode === 'password'
                ? 'M90 116 Q100 120 110 116'
                : 'M88 115 Q100 125 112 115',
          }}
          transition={{ duration: 0.4, type: 'spring' }}
        />

        {/* ── SUCCESS: Party effect ── */}
        {mode === 'success' && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <motion.circle
                key={i}
                cx={100 + Math.cos((i * Math.PI * 2) / 6) * 70}
                cy={80 + Math.sin((i * Math.PI * 2) / 6) * 70}
                r="4"
                fill={['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'][i]}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: [0, 1.5, 0],
                  opacity: [0, 1, 0],
                  y: [0, -20],
                }}
                transition={{
                  duration: 1,
                  delay: i * 0.1,
                  repeat: Infinity,
                  repeatDelay: 0.5,
                }}
              />
            ))}
          </motion.g>
        )}

        {/* ── Crown (Silver for User, Gold for Admin) ── */}
        <motion.g
          initial={{ y: -20, opacity: 0, rotate: -10 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.3 }}
        >
          {/* Crown base */}
          <polygon
            points="68,52 78,28 88,45 100,20 112,45 122,28 132,52"
            fill={isAdmin ? '#C9A84C' : '#C0C0C0'}
            stroke={isAdmin ? '#A08030' : '#8E8E8E'}
            strokeWidth="1.5"
          />
          {/* Crown band */}
          <rect x="68" y="48" width="64" height="8" rx="2"
            fill={isAdmin ? '#C9A84C' : '#C0C0C0'}
            stroke={isAdmin ? '#A08030' : '#8E8E8E'}
            strokeWidth="1"
          />
          {/* Jewels */}
          <circle cx="85" cy="35" r="3" fill={isAdmin ? '#E74C3C' : '#7EB8DA'} />
          <circle cx="100" cy="25" r="3.5" fill={isAdmin ? '#3498DB' : '#B8B8D0'} />
          <circle cx="115" cy="35" r="3" fill={isAdmin ? '#2ECC71' : '#A8C8E8'} />
          {/* Crown shine */}
          <line x1="100" y1="22" x2="100" y2="17"
            stroke={isAdmin ? '#FFE066' : '#E8E8F0'}
            strokeWidth="2" strokeLinecap="round"
          />
          <line x1="95" y1="20" x2="93" y2="16"
            stroke={isAdmin ? '#FFE066' : '#E8E8F0'}
            strokeWidth="1.5" strokeLinecap="round"
          />
          <line x1="105" y1="20" x2="107" y2="16"
            stroke={isAdmin ? '#FFE066' : '#E8E8F0'}
            strokeWidth="1.5" strokeLinecap="round"
          />
        </motion.g>
      </motion.svg>
    </div>
  );
}
