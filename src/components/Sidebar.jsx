import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Link, navigate } from '../app/router.jsx';
import { useStore } from '../app/store.jsx';
import CartMark from './CartMark.jsx';
import { Icon } from './ui.jsx';

/* A vertical take on the Apple-style dock.

   The reference component magnifies along mouseX for a bottom dock; this rail
   sits on the left, so the same maths runs on mouseY. On top of that the rail
   itself springs from collapsed to expanded while the pointer is over it, and
   each label animates in. Spring values are the reference's defaults. */

const SPRING = { mass: 0.1, stiffness: 150, damping: 12 };
const COLLAPSED = 76;
const EXPANDED = 248;
const TILE = 44;
const MAGNIFICATION = 58;
const DISTANCE = 130;

const DockContext = createContext(null);
const useDock = () => useContext(DockContext);

/* Magnification is a pointer affordance; touch and small screens skip it. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 861px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 861px)');
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

function DockTile({ children, active }) {
  const ref = useRef(null);
  const dock = useDock();

  const mouseDistance = useTransform(dock.mouseY, (val) => {
    const rect = ref.current?.getBoundingClientRect() ?? { y: 0, height: 0 };
    return val - rect.y - rect.height / 2;
  });
  const sizeTransform = useTransform(mouseDistance, [-DISTANCE, 0, DISTANCE], [TILE, MAGNIFICATION, TILE]);
  const size = useSpring(sizeTransform, SPRING);

  return (
    <motion.span
      ref={ref}
      className={`dock-tile${active ? ' is-active' : ''}`}
      style={dock.magnify ? { width: size, height: size } : undefined}
      aria-hidden="true"
    >
      {children}
    </motion.span>
  );
}

function DockRow({ to, onClick, icon, label, active, badge, children }) {
  const dock = useDock();
  const [hovered, setHovered] = useState(false);
  const As = to ? Link : 'button';
  const props = to ? { to } : { type: 'button', onClick };

  return (
    <As
      {...props}
      className={`dock-row${active ? ' is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <DockTile active={active}>{icon}</DockTile>

      {/* Expanded: the label sits inline. Collapsed: it pops out as a tooltip. */}
      <AnimatePresence initial={false}>
        {dock.expanded && (
          <motion.span
            className="dock-label"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18 }}
          >
            {children ?? label}
            {badge != null && <span className="dock-badge">{badge}</span>}
          </motion.span>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!dock.expanded && hovered && (
          <motion.span
            className="dock-tip"
            role="tooltip"
            initial={{ opacity: 0, x: -6, scale: .92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -6, scale: .92 }}
            transition={{ duration: 0.16 }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </As>
  );
}

const LINKS = [
  { to: '/app', label: 'Home', icon: 'home', match: ['app'] },
  { to: '/explore', label: 'Explore', icon: 'compass', match: ['explore'] },
  { to: '/chat', label: 'AI Food Guide', icon: 'spark', match: ['chat'] },
  { to: '/saved', label: 'Saved', icon: 'bookmark', match: ['saved'] },
];

export default function Sidebar({ head }) {
  const { profile, saved } = useStore();
  const isDesktop = useIsDesktop();
  const [expanded, setExpanded] = useState(false);

  const mouseY = useMotionValue(Infinity);
  const hovered = useMotionValue(0);
  const widthRow = useTransform(hovered, [0, 1], [COLLAPSED, EXPANDED]);
  const width = useSpring(widthRow, SPRING);

  const open = () => {
    if (!isDesktop) return;
    hovered.set(1);
    setExpanded(true);
  };
  const close = () => {
    hovered.set(0);
    mouseY.set(Infinity);
    setExpanded(false);
  };

  // collapsed on small screens, where the rail becomes a bottom bar
  useEffect(() => { if (!isDesktop) close(); }, [isDesktop]);

  return (
    <motion.aside
      className={`sidebar${expanded ? ' is-expanded' : ''}`}
      style={isDesktop ? { width } : undefined}
      onMouseMove={({ clientY }) => { open(); mouseY.set(clientY); }}
      onMouseLeave={close}
      onFocusCapture={open}
      onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) close(); }}
      aria-label="Main"
    >
      <DockContext.Provider value={{ mouseY, expanded, magnify: isDesktop }}>
        <Link to={profile.onboarded ? '/app' : '/'} className="dock-brand" aria-label="Neighbor Cart home">
          <span className="dock-tile dock-tile-brand" aria-hidden="true"><CartMark size={30} /></span>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.span
                className="dock-label brand-word"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
              >
                Neighbor<span>Cart</span>
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        <nav className="dock-nav">
          {LINKS.map((link) => (
            <DockRow
              key={link.to}
              to={link.to}
              label={link.label}
              icon={<Icon name={link.icon} size={20} />}
              active={link.match.includes(head)}
            />
          ))}
        </nav>

        <div className="dock-foot">
          <DockRow
            to={profile.onboarded ? '/chat' : '/onboarding'}
            label="Find food for me"
            icon={<Icon name="search" size={20} />}
            active={false}
          />
          <DockRow
            onClick={() => navigate('/profile')}
            label={`Your area: ${profile.zip}`}
            icon={<Icon name="pin" size={20} />}
            active={false}
          >
            {profile.city}
          </DockRow>

          {profile.onboarded ? (
            <DockRow
              to="/profile"
              label={`${profile.name} — profile`}
              icon={<span className="avatar">{profile.name.slice(0, 1)}</span>}
              active={head === 'profile'}
              badge={saved.length || null}
            >
              {profile.name}
            </DockRow>
          ) : (
            <DockRow
              to="/onboarding"
              label="Sign in"
              icon={<Icon name="user" size={20} />}
              active={false}
            />
          )}
        </div>
      </DockContext.Provider>
    </motion.aside>
  );
}
