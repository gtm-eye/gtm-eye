import { useState, useEffect } from 'react';
import { ListGroup, Card, Button, Badge } from 'react-bootstrap';
import axios from 'axios';
import moment from 'moment'; 

const GalleryTagModal = ({ tag }) => {
    const token = "to_replace"
    const [commitDates, setCommitDates] = useState([]);

    useEffect(() => {
        const fetchCommitDates = async () => {
            const dates = [];
            for (let i = 0; i < tag.collision; i++) {
                const repo = tag.repo[i];
                const sha = tag.sha[i]
                try {
                    const url = `${repo.replace("github.com", "api.github.com/repos")}/commits/${sha}`
                    console.log(url)
                    const response = await axios.get(url, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }                      
                    });
                    const commitDate = response.data.commit.author.date;
                    dates.push(commitDate);
                } catch (error) {
                    console.error('Error fetching commit date:', error);
                    dates.push('N/A'); 
                }
            }
            setCommitDates(dates);
        };

        fetchCommitDates();
    }, [tag]); 

    return (
        <ListGroup>
            {tag.tag.map((tagName, index) => (
                <ListGroup.Item key={index}>
                    <Card>
                        <Card.Body>
                            <Card.Title as="h5" className="d-flex justify-content-between align-items-center">
                                {tag.name}
                                <Badge bg="info">{tagName}</Badge>
                            </Card.Title>
                            <Card.Text>{tag.description[index]}</Card.Text>
                            <Card.Text>
                                <strong>Commit Date:</strong>&nbsp;
                                {commitDates[index] ? moment(commitDates[index]).format('MMMM Do YYYY, h:mm:ss a') : 'N/A'}
                            </Card.Text>
                            <Button
                                variant="primary"
                                href={tag.repo[index]}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                View Git Repository
                            </Button>
                        </Card.Body>
                    </Card>
                </ListGroup.Item>
            ))}
        </ListGroup>
    );
}

export default GalleryTagModal;
