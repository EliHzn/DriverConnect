// C:\Users\eliha\firebase\webapp\src\views\chat\UserList.jsx
import PropTypes from 'prop-types';
import { useEffect, useState, Fragment } from 'react';

// material-ui
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';

// project imports
import UserAvatar from './UserAvatar';

import { dispatch, useSelector } from 'store';
import { getUsers } from 'store/slices/chat';

// ==============================|| CHAT USER LIST ||============================== //

const UserList = ({ setUser }) => {
    const [data, setData] = useState([]);
    const { users } = useSelector((state) => state.chat);

    useEffect(() => {
        dispatch(getUsers());
    }, []);

    useEffect(() => {
        setData(users);
    }, [users]);

    return (
        <List component="nav">
            {data.map((user) => (
                <Fragment key={user.id}>
                    <ListItemButton
                        onClick={() => {
                            setUser(user);
                        }}
                    >
                        <ListItemAvatar>
                            <UserAvatar user={user} />
                        </ListItemAvatar>
                        <ListItemText
                            primary={
                                <Grid container alignItems="center" spacing={1} component="span">
                                    <Grid item xs zeroMinWidth component="span">
                                        <Typography
                                            variant="h5"
                                            color="inherit"
                                            component="span"
                                            sx={{
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                display: 'block'
                                            }}
                                        >
                                            {user.name}
                                        </Typography>
                                    </Grid>
                                    <Grid item component="span">
                                        <Typography component="span" variant="subtitle2">
                                            {user.lastMessage}
                                        </Typography>
                                    </Grid>
                                </Grid>
                            }
                            secondary={
                                <Grid container alignItems="center" spacing={1} component="span">
                                    <Grid item xs zeroMinWidth component="span">
                                        <Typography
                                            variant="caption"
                                            component="span"
                                            sx={{
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                display: 'block'
                                            }}
                                        >
                                            {user.status}
                                        </Typography>
                                    </Grid>
                                    <Grid item component="span">
                                        {user.unReadChatCount !== 0 && (
                                            <Chip
                                                label={user.unReadChatCount}
                                                component="span"
                                                color="secondary"
                                                sx={{
                                                    width: 20,
                                                    height: 20,
                                                    '& .MuiChip-label': {
                                                        px: 0.5
                                                    }
                                                }}
                                            />
                                        )}
                                    </Grid>
                                </Grid>
                            }
                        />
                    </ListItemButton>
                    <Divider />
                </Fragment>
            ))}
        </List>
    );
};

UserList.propTypes = {
    setUser: PropTypes.func
};

export default UserList;
