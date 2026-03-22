import React from "react";

export default function JobCard({
  job,
  isSaved,
  isCompared,
  canCompareMore,
  onToggleSave,
  onOpenDetails,
  onToggleCompare,
}) {
  return (
    <div className="job-card">
      <div className="job-card-top">
        <div>
          <h3>{job.title}</h3>
          <p className="company">{job.company}</p>
        </div>

        <button
          className={`save-btn ${isSaved ? "saved" : ""}`}
          onClick={() => onToggleSave(job)}
        >
          {isSaved ? "Saved" : "Save"}
        </button>
      </div>

      <div className="badge-row">
        <span className="badge posted-badge">{job.posted}</span>
        <span className="badge mode-badge">{job.workMode}</span>
      </div>

      <div className="meta-row">
        <span>{job.location}</span>
        <span>{job.category}</span>
      </div>

      <div className="meta-row">
        <span>{job.jobType}</span>
        <span>{job.level}</span>
      </div>

      <div className="meta-row">
        <span>{job.source}</span>
        <span>{job.salary}</span>
      </div>

      <div className="card-actions card-actions-two">
        <button className="details-btn" onClick={() => onOpenDetails(job)}>
          View Details
        </button>

        <button
          className={`compare-btn ${isCompared ? "compare-btn-active" : ""}`}
          onClick={() => onToggleCompare(job)}
          disabled={!isCompared && !canCompareMore}
        >
          {isCompared ? "Remove Compare" : "Compare"}
        </button>
      </div>
    </div>
  );
}
