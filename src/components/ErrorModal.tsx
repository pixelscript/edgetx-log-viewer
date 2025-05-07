import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Modal, Text, Button } from '@mantine/core';
import { hideErrorModal, selectErrorStatus } from '../state/uiSlice';

const ErrorModal: React.FC = () => {
  const dispatch = useDispatch();
  const { message, isModalVisible } = useSelector(selectErrorStatus);

  const handleClose = () => {
    dispatch(hideErrorModal());
  };

  if (!isModalVisible || !message) {
    return null;
  }

  return (
    <Modal
      opened={isModalVisible}
      onClose={handleClose}
      title="Error"
      centered
    >
      <Text>{message}</Text>
      <Button onClick={handleClose} mt="md">
        Close
      </Button>
    </Modal>
  );
};

export default ErrorModal;