package com.culinarycraft.media;

import com.culinarycraft.model.DemoUser;
import com.culinarycraft.persistence.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.support.*;
import static org.mockito.Mockito.*;

class MediaCompletionTest {
    @Test void unknownCommitOutcomeKeepsFileForReferenceCheckedGarbageCollection() {
        var files = mock(MediaRepository.class); var storage = mock(ImageStorage.class); var users = mock(DemoUserRepository.class);
        var account = mock(DemoUserEntity.class); var id = UUID.randomUUID();
        when(account.getStatus()).thenReturn("ACTIVE"); when(account.toModel()).thenReturn(new DemoUser(9, "Author", "USER", "A", ""));
        when(users.lockById(9L)).thenReturn(Optional.of(account)); when(files.findByOwnerIdAndKind(9L, "AVATAR")).thenReturn(List.of());
        when(storage.write(any())).thenReturn(new ImageStorage.Stored(id, 10, 1, 1));
        when(files.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        var service = new MediaService(files, storage, users, mock(RecipeRepository.class), mock(MediaReferences.class));
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.avatar(9, new MockMultipartFile("file", new byte[] {1}));
            var callbacks = TransactionSynchronizationManager.getSynchronizations();
            callbacks.forEach(callback -> callback.afterCompletion(TransactionSynchronization.STATUS_UNKNOWN));
            verify(storage, never()).delete(id);
            callbacks.forEach(callback -> callback.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
            verify(storage).delete(id);
        } finally { TransactionSynchronizationManager.clearSynchronization(); }
    }
}
