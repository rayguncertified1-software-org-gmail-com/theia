/********************************************************************************
 * Copyright (C) 2021 Ericsson and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { injectable, inject, postConstruct, named } from 'inversify';
import { TreeDecorator, TreeDecoration } from '@theia/core/lib/browser/tree/tree-decorator';
import { Emitter } from '@theia/core/lib/common/event';
import { Tree } from '@theia/core/lib/browser/tree/tree';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { DepthFirstTreeIterator, LabelProvider } from '@theia/core/lib/browser';
import { FileStatNode } from '@theia/filesystem/lib/browser';
import URI from '@theia/core/lib/common/uri';


@injectable()
export class OpenEditorsFileDecorator implements TreeDecorator {
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    @inject(LabelProvider) protected readonly labelProvider: LabelProvider;

    readonly id = 'theia-open-editors-file-decorator';
    // THIS SHOULD FIRE ONLY WHEN SAVEABLE STATE CHANGES
    protected decorationsMap = new Map<string, TreeDecoration.Data>();

    protected readonly decorationsChangedEmitter = new Emitter();
    readonly onDidChangeDecorations = this.decorationsChangedEmitter.event;
    @postConstruct()
    init(): void {
        this.workspaceService.onWorkspaceChanged(event => {
            this.fireDidChangeDecorations((tree: Tree) => this.collectDecorators(tree));
        });
        this.workspaceService.onWorkspaceLocationChanged(event => {
            this.fireDidChangeDecorations((tree: Tree) => this.collectDecorators(tree));
        });
    }

    protected fireDidChangeDecorations(event: (tree: Tree) => Map<string, TreeDecoration.Data>): void {
        this.decorationsChangedEmitter.fire(event);
    }

    decorations(tree: Tree): Map<string, TreeDecoration.Data> {
        return this.collectDecorators(tree);
    }

    protected async collectDecorators(tree: Tree): Promise<Map<string, TreeDecoration.Data>> {

        const result = new Map<string, TreeDecoration.Data>();
        if (tree.root === undefined) {
            return result;
        }
        for (const node of new DepthFirstTreeIterator(tree.root)) {
            if (FileStatNode.is(node)) {

                const path = await this.resolvePathString(node.uri)
                result.set(node.id, {
                    captionSuffixes: [{ data: path }]
                });
            }
        }
        return result;
    }

    protected async resolvePathString(nodeURI: URI): Promise<string> {
        const workspaceRoots = await this.workspaceService.roots;
        const parentWorkspace = workspaceRoots.find(({ resource }) => resource.isEqualOrParent(nodeURI));
        if (parentWorkspace) {
            const relativePathURI = parentWorkspace.resource.relative(nodeURI);
            const workspacePrefixString = workspaceRoots.length > 1 ? parentWorkspace.name : '';
            const filePathString = relativePathURI?.hasDir ? relativePathURI.toString() : '';
            const separator = filePathString && workspacePrefixString ? ' * ' : '';
            return `${workspacePrefixString}${separator}${filePathString}`;
        }
        return '';
    }
}
