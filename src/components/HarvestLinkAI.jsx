import React from 'react';
import AiChat from './AiChat.jsx';

/* The navigator in a modal, for entry points that are not the workspace's own
   chat section. Both render the same conversation so the two never drift. */
export default function HarvestLinkAI({ onClose, onSelectPlace, onShowMatches, onOpenRescue, onOpenPlan, sectionId }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="ai-modal-card" onClick={(event) => event.stopPropagation()}>
        <AiChat
          variant="modal"
          sectionId={sectionId}
          onClose={onClose}
          onSelectPlace={onSelectPlace}
          onShowMatches={onShowMatches}
          onOpenRescue={onOpenRescue}
          onOpenPlan={onOpenPlan}
        />
      </div>
    </div>
  );
}
