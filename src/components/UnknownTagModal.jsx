import '@fortawesome/fontawesome-free/css/all.min.css';

const UnknownTagModal = ({tag}) => {
      return (
        <>
            <h4 className="mb-3">
                Custom Tag
                {tag.inject_script && (
                    <span className="text-danger ms-2" title="Script injection detected">
                    <i className="fas fa-exclamation-triangle"></i>
                    </span>
                )}
            </h4>
            <p><strong>Permissions :</strong></p>
            <pre className="bg-light p-3 rounded">{JSON.stringify(tag.perms)}</pre>
        </>
    );
}

export default UnknownTagModal;
