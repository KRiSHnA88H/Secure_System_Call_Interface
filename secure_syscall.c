#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <fcntl.h>
#include <time.h>
#include <sys/wait.h>
#include <dirent.h>
#include <sys/stat.h>
#include <stdlib.h>

void log_action(const char *action) {
    FILE *log = fopen("syscall.log", "a");
    time_t now = time(NULL);
    fprintf(log, "%s: %s\n", ctime(&now), action);
    fclose(log);
}

int is_safe_path(const char *path) {
    if (strstr(path, "..")) return 0;
    return 1;
}

int is_allowed_command(const char *cmd) {
    return (strcmp(cmd, "ls") == 0 ||
            strcmp(cmd, "date") == 0 ||
            strcmp(cmd, "whoami") == 0);
}

int main(int argc, char *argv[]) {

    if (argc < 2) {
        printf("No action provided\n");
        return 1;
    }

    char *action = argv[1];

    // 🔹 WRITE
    if (strcmp(action, "write") == 0) {
        if (argc < 3) {
            printf("No message\n");
            return 1;
        }
        write(1, argv[2], strlen(argv[2]));
        log_action("write");
    }

    // 🔹 GETPID
    else if (strcmp(action, "getpid") == 0) {
        printf("PID: %d\n", getpid());
        log_action("getpid");
    }

    // 🔹 CREATE
    else if (strcmp(action, "create") == 0) {
        if (argc < 3 || !is_safe_path(argv[2])) {
            printf("Invalid file\n");
            return 1;
        }

        int fd = open(argv[2], O_CREAT | O_WRONLY, 0644);
        if (fd < 0) {
            printf("Error creating file\n");
            return 1;
        }

        printf("File created\n");
        close(fd);
        log_action("create");
    }

    // 🔹 READ
    else if (strcmp(action, "read") == 0) {
        if (argc < 3 || !is_safe_path(argv[2])) {
            printf("Invalid file\n");
            return 1;
        }

        int fd = open(argv[2], O_RDONLY);
        if (fd < 0) {
            printf("File not found\n");
            return 1;
        }

        char buffer[500];
        int n = read(fd, buffer, sizeof(buffer)-1);

        if (n > 0) {
            buffer[n] = '\0';
            printf("%s", buffer);
        }

        close(fd);
        log_action("read");
    }

    // 🔹 DELETE
    else if (strcmp(action, "delete") == 0) {
        if (argc < 3 || !is_safe_path(argv[2])) {
            printf("Invalid file\n");
            return 1;
        }

        if (unlink(argv[2]) == 0)
            printf("File deleted\n");
        else
            printf("Delete failed\n");

        log_action("delete");
    }

    // 🔹 APPEND
    else if (strcmp(action, "append") == 0) {
        if (argc < 4 || !is_safe_path(argv[2])) {
            printf("Invalid input\n");
            return 1;
        }

        int fd = open(argv[2], O_WRONLY | O_APPEND | O_CREAT, 0644);
        write(fd, argv[3], strlen(argv[3]));
        write(fd, "\n", 1);
        close(fd);

        printf("Appended\n");
        log_action("append");
    }

    // 🔹 RENAME
    else if (strcmp(action, "rename") == 0) {
        if (argc < 4 || !is_safe_path(argv[2]) || !is_safe_path(argv[3])) {
            printf("Invalid input\n");
            return 1;
        }

        if (rename(argv[2], argv[3]) == 0)
            printf("Renamed\n");
        else
            printf("Rename failed\n");

        log_action("rename");
    }

    // 🔹 LIST
    else if (strcmp(action, "list") == 0) {
        DIR *d = opendir(".");
        struct dirent *dir;

        while ((dir = readdir(d)) != NULL) {
            printf("%s\n", dir->d_name);
        }

        closedir(d);
        log_action("list");
    }

    // 🔹 STAT
    else if (strcmp(action, "stat") == 0) {
        if (argc < 3 || !is_safe_path(argv[2])) {
            printf("Invalid file\n");
            return 1;
        }

        struct stat st;

        if (stat(argv[2], &st) == 0) {
            printf("Size: %ld bytes\n", st.st_size);
            printf("Permissions: %o\n", st.st_mode & 0777);
        } else {
            printf("File not found\n");
        }

        log_action("stat");
    }

    // 🔹 CHMOD
    else if (strcmp(action, "chmod") == 0) {
        if (argc < 4 || !is_safe_path(argv[2])) {
            printf("Invalid input\n");
            return 1;
        }

        int mode = strtol(argv[3], NULL, 8);

        if (chmod(argv[2], mode) == 0)
            printf("Permissions changed\n");
        else
            printf("chmod failed\n");

        log_action("chmod");
    }

    // 🔹 FORK
    else if (strcmp(action, "fork") == 0) {
        pid_t pid = fork();

        if (pid == 0)
            printf("Child PID: %d\n", getpid());
        else
            printf("Parent PID: %d\n", getpid());

        log_action("fork");
    }

    // 🔹 EXEC
    else if (strcmp(action, "exec") == 0) {
        if (argc < 3 || !is_allowed_command(argv[2])) {
            printf("Command not allowed\n");
            return 1;
        }

        pid_t pid = fork();

        if (pid == 0) {
            execlp(argv[2], argv[2], NULL);
        } else {
            wait(NULL);
        }

        log_action("exec");
    }

    else {
        printf("Invalid syscall\n");
    }

    return 0;
}
