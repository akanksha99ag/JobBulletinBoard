import React from "react";

export default function JobModal({
  selectedJob,
  isSaved,
  onClose,
  onToggleSave,
  onApplyClick,
  showLeaveNotice,
}) {
  if (!selectedJob) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <div>
            <p className="eyebrow modal-eyebrow">{selectedJob.category}</p>
            <h2>{selectedJob.title}</h2>
            <p className="modal-company">{selectedJob.company}</p>
          </div>

          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="trust-row">
          <span className="trust-pill">Source: {selectedJob.source}</span>
          <span className="trust-pill subtle-pill">External apply site</span>
        </div>

        <div className="modal-info-grid">
          <div className="info-box">
            <span>Location</span>
            <strong>{selectedJob.location}</strong>
          </div>
          <div className="info-box">
            <span>Region</span>
            <strong>{selectedJob.region}</strong>
          </div>
          <div className="info-box">
            <span>Work Mode</span>
            <strong>{selectedJob.workMode}</strong>
          </div>
          <div className="info-box">
            <span>Experience</span>
            <strong>{selectedJob.level}</strong>
          </div>
          <div className="info-box">
            <span>Source</span>
            <strong>{selectedJob.source}</strong>
          </div>
          <div className="info-box">
            <span>Posted</span>
            <strong>{selectedJob.posted}</strong>
          </div>
          <div className="info-box">
            <span>Salary</span>
            <strong>{selectedJob.salary}</strong>
          </div>
          <div className="info-box">
            <span>Type</span>
            <strong>{selectedJob.jobType}</strong>
          </div>
        </div>

        <div className="modal-section">
          <h3>Job Description</h3>
          <p>{selectedJob.description}</p>
        </div>

        {showLeaveNotice && (
          <div className="leave-notice">
            You are leaving this platform and opening the original external job
            source.
          </div>
        )}

        <div className="modal-actions">
          <button
            className={`save-btn ${isSaved ? "saved" : ""}`}
            onClick={() => onToggleSave(selectedJob)}
          >
            {isSaved ? "Saved" : "Save Job"}
          </button>

          <a
            className="apply-link"
            href={selectedJob.applyLink}
            target="_blank"
            rel="noreferrer"
            onClick={onApplyClick}
          >
            Apply Now
          </a>
        </div>
      </div>
    </div>
  );
}
